# Phase 5: Migrate ai-native

## Objective

Collapse the `ai-native` dual-package monorepo (`packages/saas` + `packages/busibox`) into a **single Next.js app** that uses the platform abstraction layer. The app imports `@jazzmind/busibox-app/platform` and works on both Vercel and Busibox without code changes — determined entirely by environment variables.

## Gate condition

- Single `packages/app` directory replaces both `packages/saas` and `packages/busibox`
- `pnpm dev` with `DATABASE_URL` + `ANTHROPIC_API_KEY` starts the Vercel path
- `pnpm dev` with `AGENT_API_URL` + `DATA_API_URL` starts the Busibox path
- All existing functionality works on both platforms: chat, routing, advisors, knowledge, conversations
- `pnpm build` produces a single Next.js build that works in both deployment modes
- Integration tests pass against both platform configurations
- `packages/saas` and `packages/busibox` directories are removed

---

## 5.1 Current architecture (what we're replacing)

```
ai-native/
├── packages/
│   ├── core/          # @ai-native/core — shared types, parsers, UI
│   ├── saas/          # Vercel: Anthropic CMA + Neon + Auth.js
│   └── busibox/       # Busibox: agent-api + data-api + busibox-app SSO
```

Parallel implementations that must merge:

| Feature | SaaS file | Busibox file | Unified approach |
|---------|-----------|--------------|------------------|
| Chat streaming | `app/api/chat/route.ts` (CMA sessions) | `app/api/chat/route.ts` (agent-api SSE) | `platform.ai.streamChat()` |
| Routing | `lib/router.ts` (Anthropic direct) | `lib/router.ts` (agent-api /runs/invoke) | `platform.ai.invoke()` |
| Conversations | `lib/db/schema.ts` (Drizzle) | `lib/data-api-client.ts` (data-api CRUD) | `platform.data.query/insert()` |
| Knowledge | `lib/knowledge/postgres-provider.ts` | `lib/knowledge.ts` (search-api) | `platform.search.search()` |
| Auth | Auth.js v5 | Busibox SSO + busibox-app SessionProvider | `platform.auth` (optional) |
| Agent sync | CMA deploy adapter | `syncAgentDefinitions()` | `platform.ai.syncAgents()` |

---

## 5.2 New structure

```
ai-native/
├── packages/
│   ├── core/          # @ai-native/core — shared types, parsers, UI (UNCHANGED)
│   └── app/           # Single Next.js app (replaces saas + busibox)
│       ├── app/
│       │   ├── (authenticated)/
│       │   ├── api/
│       │   │   ├── chat/route.ts          # Uses platform.ai.streamChat()
│       │   │   ├── conversations/route.ts # Uses platform.data
│       │   │   └── knowledge/route.ts     # Uses platform.search
│       │   └── layout.tsx
│       ├── lib/
│       │   ├── platform.ts               # getPlatform() + adapter import
│       │   ├── router.ts                 # Uses platform.ai.invoke()
│       │   ├── advisors.ts              # Advisor definitions (shared)
│       │   └── auth.ts                  # Auth.js config (used by Vercel adapter)
│       ├── next.config.ts               # Conditional standalone output
│       └── package.json
└── advisors/          # Shared advisor INSTRUCTIONS.md (UNCHANGED)
```

---

## 5.3 Platform initialization (`lib/platform.ts`)

```typescript
import { getPlatform, type Platform } from '@jazzmind/busibox-app/platform';

// Import the correct adapter based on detected platform
if (process.env.AGENT_API_URL || process.env.DATA_API_URL) {
  require('@jazzmind/busibox-app/platform/busibox');
} else {
  require('@jazzmind/busibox-app/platform/vercel');
}

export const platform: Platform = getPlatform();
export const { ai, data, search, storage, auth } = platform;
```

---

## 5.4 Unified chat route

```typescript
// app/api/chat/route.ts
import { ai, auth } from '@/lib/platform';
import { getRouter } from '@/lib/router';
import { getAdvisorInstructions } from '@/lib/advisors';

export async function POST(request: Request) {
  const user = await auth.requireAuth!(request);
  const { messages, conversationId, advisorKey } = await request.json();

  // Route to the correct advisor
  const advisor = advisorKey
    ? getAdvisorInstructions(advisorKey)
    : await getRouter().route(messages);

  // Stream via platform adapter
  const stream = await ai.streamChat({
    messages,
    agent: advisor.agentName,
    systemPrompt: advisor.instructions,
    model: advisor.model,
  });

  // Return as SSE response
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

---

## 5.5 Unified router

```typescript
// lib/router.ts
import { ai } from '@/lib/platform';
import { z } from 'zod';
import { ADVISOR_META } from '@/lib/advisors';

const RoutingSchema = z.object({
  advisor: z.string(),
  confidence: z.number(),
  reasoning: z.string(),
});

export async function routeMessage(messages: Array<{ role: string; content: string }>) {
  const lastMessage = messages[messages.length - 1]?.content ?? '';

  const result = await ai.invoke({
    agent: 'router',
    input: {
      prompt: lastMessage,
      advisors: ADVISOR_META.map(a => `${a.key}: ${a.description}`).join('\n'),
    },
    responseSchema: RoutingSchema,
    model: 'fast', // Uses cheapest model
  });

  return result;
}
```

---

## 5.6 Unified data operations

```typescript
// app/api/conversations/route.ts
import { data, auth } from '@/lib/platform';

export async function GET(request: Request) {
  const user = await auth.requireAuth!(request);

  const result = await data.query('conversations', {
    filters: [{ field: 'user_id', op: 'eq', value: user.id }],
    sort: [{ field: 'updated_at', direction: 'desc' }],
    limit: 50,
  });

  return Response.json(result.records);
}

export async function POST(request: Request) {
  const user = await auth.requireAuth!(request);
  const { title } = await request.json();

  const ids = await data.insert('conversations', [{
    user_id: user.id,
    title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }]);

  return Response.json({ id: ids[0] });
}
```

---

## 5.7 Next.js config (conditional output)

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const isBusibox = process.env.BUSIBOX_PLATFORM === 'busibox'
  || !!process.env.AGENT_API_URL;

const basePath = isBusibox
  ? (process.env.NEXT_PUBLIC_BASE_PATH || '/ai-native')
  : '';

const nextConfig: NextConfig = {
  output: isBusibox ? 'standalone' : undefined,
  basePath,
  assetPrefix: basePath || undefined,
  transpilePackages: ['@ai-native/core', '@jazzmind/busibox-app'],
};

export default nextConfig;
```

---

## 5.8 Migration steps

1. Create `packages/app/` with the unified structure
2. Copy `@ai-native/core` shared components (unchanged)
3. Rewrite API routes to use `platform.ai`, `platform.data`, `platform.search`
4. Rewrite `lib/router.ts` to use `platform.ai.invoke()` instead of direct Anthropic / agent-api calls
5. Move advisor definitions to a shared location (they're already in `advisors/`)
6. Keep Auth.js config in `lib/auth.ts` — the Vercel auth adapter wraps it
7. Update `next.config.ts` for conditional output
8. Update root `package.json` scripts: `dev` → `pnpm --filter app dev`
9. Delete `packages/saas` and `packages/busibox`
10. Verify both deployment modes work

---

## 5.9 Collection schema registration

On app startup, register all collection schemas so both platforms know the data shape:

```typescript
// lib/collections.ts
import { data } from '@/lib/platform';
import type { CollectionSchema } from '@jazzmind/busibox-app/platform/interfaces';

export const COLLECTIONS = {
  conversations: {
    fields: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'user_id', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'advisor_key', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamp' },
      { name: 'updated_at', type: 'timestamp' },
    ],
  } satisfies CollectionSchema,

  messages: {
    fields: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'conversation_id', type: 'uuid', references: { collection: 'conversations', field: 'id' } },
      { name: 'role', type: 'text' },
      { name: 'content', type: 'text' },
      { name: 'metadata', type: 'json', nullable: true },
      { name: 'created_at', type: 'timestamp' },
    ],
  } satisfies CollectionSchema,
} as const;

export async function ensureCollections() {
  for (const [name, schema] of Object.entries(COLLECTIONS)) {
    await data.ensureCollection(name, schema);
  }
}
```

---

## File changes summary

| File | Action |
|------|--------|
| `packages/app/` (entire directory) | Create |
| `packages/app/app/api/chat/route.ts` | Create (unified) |
| `packages/app/app/api/conversations/route.ts` | Create (unified) |
| `packages/app/lib/platform.ts` | Create |
| `packages/app/lib/router.ts` | Create (unified) |
| `packages/app/lib/advisors.ts` | Create (from shared advisors/) |
| `packages/app/lib/collections.ts` | Create |
| `packages/app/next.config.ts` | Create |
| `packages/app/package.json` | Create |
| `packages/saas/` | Delete |
| `packages/busibox/` | Delete |
| Root `package.json` | Update scripts |

---

## Anti-shortcut rules

- NEVER import directly from `@ai-sdk/anthropic` or `@neondatabase/serverless` in app code — always go through `platform.ai` / `platform.data`
- NEVER use `if (platform === 'busibox')` conditionals in business logic — the adapter handles differences
- NEVER remove advisor definitions or CMA deploy logic — keep `syncAgents` for Busibox; it no-ops on Vercel
- NEVER hardcode model names — use tier hints ('fast', 'smart') that adapters resolve to platform-specific models
- NEVER break the Electron desktop app — it should continue to work via the Vercel adapter locally
- NEVER remove `@ai-native/core` — its UI components and parsers are still needed

---

## Verification

1. `BUSIBOX_PLATFORM=vercel DATABASE_URL=... ANTHROPIC_API_KEY=... pnpm dev` starts successfully
2. `BUSIBOX_PLATFORM=busibox AGENT_API_URL=... DATA_API_URL=... pnpm dev` starts successfully
3. Chat streaming works on both platforms (manual test: send a message, see streamed response)
4. Conversations persist and load on both platforms
5. Advisor routing selects the correct advisor on both platforms
6. `pnpm build` succeeds for both `output: undefined` (Vercel) and `output: 'standalone'` (Busibox)
7. Existing Vercel deployment continues to work after migration
8. Docker container with standalone output works behind Busibox portal
