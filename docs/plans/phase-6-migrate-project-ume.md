# Phase 6: Migrate project-ume

## Objective

Collapse the `project-ume` dual-package monorepo (`packages/saas` + `packages/busibox`) into a **single Next.js app** using the platform abstraction layer. This is more complex than ai-native because project-ume has a richer data model (courses, modules, lessons, activities, quizzes, generation jobs) and deeper AI integration (content generation, evaluation, QA agents).

## Gate condition

- Single app replaces both `packages/saas` and `packages/busibox`
- All 74 API routes work on both Vercel and Busibox platforms
- Content generation pipeline (intake → scaffold → generate → validate) works on both platforms
- `ContentService` interface is replaced by direct `platform.data` calls
- BYOK (bring your own key) and multi-model support works via `platform.ai` configuration
- Integration tests pass against both platform configurations
- `packages/busibox` scaffold directory is removed (saas becomes the unified app)

---

## 6.1 Current architecture (what we're replacing)

```
project-ume/
├── packages/
│   ├── core/          # @project-ume/core — ContentService interface, types, harnesses
│   ├── saas/          # FULL APP: 74 routes, Drizzle, AI SDK, Auth.js
│   ├── busibox/       # SCAFFOLD: manifest only (Phase 19 was planned)
│   └── test/          # Shared tests
```

Key difference from ai-native: project-ume's SaaS package IS the app — busibox was never built. So this migration is about making the existing saas app platform-agnostic, not merging two implementations.

**What needs abstraction:**

| Layer | Current (saas) | Platform equivalent |
|-------|----------------|---------------------|
| DB access | `lib/db/index.ts` (Drizzle + Neon) | `platform.data` |
| AI calls | `lib/ai-provider.ts` (AI SDK direct) | `platform.ai` |
| Content queries | `lib/content-service-db.ts` (DbContentService) | `platform.data.query()` |
| Auth | `lib/server-auth.ts` (Auth.js) | `platform.auth` (optional — can keep Auth.js) |
| File storage | `@vercel/blob` (attachments) | `platform.storage` |
| Search | Postgres FTS on lessons | `platform.search` |

---

## 6.2 Migration strategy

Since project-ume only has a functional saas package, the migration is an **in-place refactor** rather than a merge:

1. Add `@jazzmind/busibox-app` as a dependency
2. Create `lib/platform.ts` initialization
3. Replace `DbContentService` with `platform.data` calls
4. Replace `getAIModel()` with `platform.ai`
5. Replace `@vercel/blob` usage with `platform.storage`
6. Update `next.config.ts` for conditional output
7. Delete `packages/busibox/` scaffold
8. Optionally keep `@project-ume/core` for types and harness registry (non-platform concerns)

---

## 6.3 ContentService → platform.data

The existing `ContentService` interface maps cleanly to the data adapter:

```typescript
// Before (lib/content-service-db.ts):
async getCourse(id: string): Promise<Course | null> {
  const [course] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  return course ?? null;
}

// After (lib/content.ts):
import { data } from '@/lib/platform';

export async function getCourse(id: string): Promise<Course | null> {
  return data.get<Course>('courses', id);
}

export async function getCoursesForUser(userId: string): Promise<Course[]> {
  const result = await data.query<Course>('courses', {
    filters: [{ field: 'learner_id', op: 'eq', value: userId }],
    sort: [{ field: 'created_at', direction: 'desc' }],
  });
  return result.records;
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  const ids = await data.insert('courses', [input]);
  return (await data.get<Course>('courses', ids[0]))!;
}
```

---

## 6.4 AI provider → platform.ai

```typescript
// Before (lib/ai-provider.ts):
export async function getAIModel(userId: string, tier: ModelTier) {
  // Check user BYOK keys, decrypt, return anthropic(model, { apiKey })
  // ...fallback to system key
}

// After (lib/ai.ts):
import { ai } from '@/lib/platform';

// The platform AI adapter handles model resolution internally.
// For BYOK: configure the adapter with user-specific keys at request time.
// This is an area where project-ume's BYOK needs custom handling on top of the base adapter.

export async function streamForUser(userId: string, params: StreamParams) {
  // BYOK keys are a project-ume concern, not a platform concern.
  // Option A: Inject user API key into platform config per-request
  // Option B: Keep BYOK as app-level logic that wraps platform.ai
  const userKey = await getUserApiKey(userId);
  if (userKey) {
    // Direct call with user's key — bypasses platform adapter for BYOK
    const { streamText } = await import('ai');
    const { anthropic } = await import('@ai-sdk/anthropic');
    return streamText({ model: anthropic(userKey.model, { apiKey: userKey.decryptedKey }), ...params });
  }
  // System key path — goes through platform
  return ai.streamChat(params);
}
```

**Design decision:** BYOK is app-specific logic that sits ON TOP of the platform layer. The platform provides the default path; the app can bypass it for user-specific keys.

---

## 6.5 Collection schemas

```typescript
// lib/collections.ts
import { data } from '@/lib/platform';
import type { CollectionSchema } from '@jazzmind/busibox-app/platform/interfaces';

export const SCHEMAS = {
  courses: {
    fields: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'learner_id', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'topic', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'metadata', type: 'json', nullable: true },
      { name: 'created_at', type: 'timestamp' },
      { name: 'updated_at', type: 'timestamp' },
    ],
  } satisfies CollectionSchema,

  course_modules: {
    fields: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'course_id', type: 'uuid', references: { collection: 'courses', field: 'id' } },
      { name: 'title', type: 'text' },
      { name: 'description', type: 'text' },
      { name: 'status', type: 'text' },
      { name: 'order', type: 'integer' },
      { name: 'excitement', type: 'integer', nullable: true },
      { name: 'estimated_time', type: 'text', nullable: true },
      { name: 'key_skills', type: 'json', nullable: true },
      { name: 'video_url', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamp' },
      { name: 'updated_at', type: 'timestamp' },
    ],
  } satisfies CollectionSchema,

  course_lessons: {
    fields: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'module_id', type: 'uuid', references: { collection: 'course_modules', field: 'id' } },
      { name: 'title', type: 'text' },
      { name: 'content', type: 'text' },
      { name: 'order', type: 'integer' },
      { name: 'metadata', type: 'json', nullable: true },
      { name: 'created_at', type: 'timestamp' },
    ],
  } satisfies CollectionSchema,

  // + course_activities, course_quizzes, generation_jobs, learner_profiles,
  //   user_api_keys, progress, quiz_scores, badges, activity_responses, users
} as const;
```

---

## 6.6 Content generation pipeline

The generation pipeline (`lib/generation/generate-module.ts`) currently calls Anthropic directly via `getAIModel()`. Migration:

```typescript
// Before:
const model = await getAIModel(course.learnerId, 'smart');
const { object } = await generateObject({ model, schema: ModuleContentSchema, prompt });

// After:
import { ai } from '@/lib/platform';

const result = await ai.invoke({
  input: { courseContext, moduleTitle, learnerProfile },
  responseSchema: ModuleContentSchema,
  model: 'smart',
});
```

The QA agents (Learning Twin, Expert Reviewer) are more complex — they use Playwright and multi-step evaluation. These should remain as app-level logic that calls `platform.ai.invoke()` for the AI portions but keeps the Playwright orchestration unchanged.

---

## 6.7 Auth handling

Project-ume has complex auth: TOTP + Microsoft EntraID SSO + Portal JWT SSO. The auth adapter is optional, so:

- **Vercel path**: Keep Auth.js as-is in `lib/auth.ts`. The `VercelAuthAdapter` wraps it.
- **Busibox path**: `BusiboxAuthAdapter` handles Zero Trust token exchange.
- **`requireAuth()`** in API routes: calls `platform.auth.requireAuth(request)` which delegates to the active adapter.

```typescript
// lib/auth-guard.ts
import { auth } from '@/lib/platform';

export async function requireAuth(request: Request) {
  return auth.requireAuth!(request);
}

export async function requireAdmin(request: Request) {
  const user = await auth.requireAuth!(request);
  if (user.role !== 'admin') throw new Error('Forbidden');
  return user;
}
```

---

## 6.8 What stays app-level (not abstracted)

| Concern | Why it stays |
|---------|--------------|
| BYOK (user API keys) | App-specific feature, not a platform concern |
| Activity harness registry | UI rendering logic, not a platform service |
| Static module fallback | Legacy content strategy specific to project-ume |
| Branding/BrandConfig | UI concern handled by `@project-ume/core` |
| Spaced repetition | App-specific learning algorithm |
| Group collaboration | App-specific social features |

---

## 6.9 Dependency changes

```json
// packages/saas/package.json (becomes packages/app/package.json)
{
  "dependencies": {
    "@jazzmind/busibox-app": "^3.1.0",  // Add (for platform layer)
    "@project-ume/core": "workspace:*",  // Keep
    // Remove direct Drizzle/Neon/AI SDK deps — they become optional peer deps of busibox-app
    // Keep only if BYOK feature needs direct AI SDK access
  }
}
```

---

## File changes summary

| File | Action |
|------|--------|
| `packages/saas/lib/platform.ts` | Create |
| `packages/saas/lib/content.ts` | Create (replaces content-service-db.ts) |
| `packages/saas/lib/collections.ts` | Create |
| `packages/saas/lib/auth-guard.ts` | Create (wraps platform.auth) |
| `packages/saas/lib/content-service-db.ts` | Delete (replaced by platform.data calls) |
| `packages/saas/lib/db/index.ts` | Delete (replaced by VercelDataAdapter) |
| `packages/saas/next.config.ts` | Update (conditional output) |
| `packages/saas/package.json` | Update (add busibox-app dep) |
| `packages/busibox/` | Delete (scaffold no longer needed) |
| `packages/core/src/content-service.ts` | Update (keep interface for backward compat, mark deprecated) |

---

## Anti-shortcut rules

- NEVER remove the static content fallback (`lib/module-data.ts`) — seed-* IDs must continue to work
- NEVER remove BYOK functionality — it's a key user feature, handled as app-level logic wrapping the platform
- NEVER abstract the QA agent pipeline into the platform layer — Playwright orchestration is app-specific
- NEVER change the user-facing API contract (route paths, request/response shapes) — this is an internal refactor
- NEVER remove `@project-ume/core` — its types, harnesses, and branding logic are still needed
- NEVER delete the test package — tests should be updated to work against the unified app
- NEVER use `--force-reset` or `--accept-data-loss` on the database during migration

---

## Verification

1. All 74 existing API routes return the same responses after migration
2. `pnpm dev` with Vercel env vars: course creation, module generation, chat all work
3. `pnpm dev` with Busibox env vars: same features work via agent-api + data-api
4. BYOK: user can save an API key and subsequent AI calls use it (Vercel path)
5. Content generation: intake → scaffold → generate → validate pipeline completes
6. Static seed content (`seed-mod-*` IDs) still loads via fallback
7. `pnpm build` succeeds in both modes
8. `pnpm test` passes for all existing tests
9. E2E tests pass against the running unified app
