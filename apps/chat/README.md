# Busibox Chat

Next.js Chat app for Busibox.

- Package: `@busibox/chat`
- Local port: `3003`
- Deployed base path: `/chat`
- Auth: `busibox-session` cookie issued by the Portal/AuthZ flow
- Backend: sibling `busibox` Agent API

Read the repository-root `AGENTS.md` before coordinated work. The current architecture and route map are in:

- [`../../docs/developers/architecture/02-chat.md`](../../docs/developers/architecture/02-chat.md)
- [`../../docs/developers/reference/chat-api.md`](../../docs/developers/reference/chat-api.md)
- [`../../docs/developers/guides/chat-multi-agent-work.md`](../../docs/developers/guides/chat-multi-agent-work.md)

## Run locally

From the monorepo root:

```bash
pnpm install
pnpm dev:chat
```

The authenticated runtime also needs the Portal/AuthZ session, the Agents app catch-all proxy, and reachable Agent API services. `/chat/demo` is a static Marine mock for presentation work only; it does not exercise auth, proxying, persistence, tools, attachments, or document citations.

## UI ownership

- `src/app/(authenticated)/page.tsx` selects Marine or the shared Chat page and creates the server Agent client.
- `src/components/chat/themes/marine/*` is the deployed Marine presentation when `NEXT_PUBLIC_CHAT_BRAND=marine`.
- `../../packages/app` contains shared Chat UI, types, clients, streaming hook, and event processor.
- `../agents/src/app/api/agent/[...path]/route.ts` is the browser proxy used by Marine conversation and SSE calls.
- `src/app/api/chat/conversations/[id]/attachments/route.ts` is the Chat-owned attachment BFF.

## Focused checks

```bash
pnpm --filter @busibox/chat test --run
pnpm --filter @busibox/chat lint
pnpm --filter @busibox/chat build
pnpm type-check
```

Record source/build checks separately from authenticated browser, backend, and persisted-history verification.
