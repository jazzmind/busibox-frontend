# Chat App

**Package:** `@busibox/chat`

**Port:** 3003

**Base path:** `/chat`

## Purpose

The Chat app provides authenticated conversations, agentic SSE responses, attachments, tools, citations, and document source viewing. Deployment currently selects the Marine presentation with `NEXT_PUBLIC_CHAT_BRAND=marine`; the app can also render the reusable shared `ChatPage`.

## Pages

| Route | Purpose |
|---|---|
| `/chat` | Authenticated page; `?conversation=<uuid>` selects initial history |
| `/chat/<conversationId>` | Redirects to the query-parameter form |
| `/chat/demo` | Public canned Marine mock; no backend or persistence |

## Route classification

- **Marine-active:** Agent/conversation/history/SSE calls through `/agents/api/agent/*`; Chat-local attachment upload; session/health/version; Documents source routes.
- **Shared/default UI:** reusable `packages/app` Chat components and a wider set of Chat-local conversation/model/search routes.
- **Support/compatibility:** older direct `/chat/api/chat` and compatibility handlers. Confirm a caller before changing them.

Chat-local API routes include session, conversation CRUD, attachment upload, sharing, title, message delete, insights, models, web/document search, health, and version. See [`../architecture/02-chat.md`](../architecture/02-chat.md) for the exact active flow and [`../reference/chat-api.md`](../reference/chat-api.md) for the backend contract.

## Key files

| Area | Files |
|---|---|
| Server auth/composition | `apps/chat/src/app/(authenticated)/page.tsx` |
| Marine preload | `apps/chat/src/components/chat/themes/marine/ChatPage.tsx` |
| Marine state/CRUD/send | `apps/chat/src/components/chat/themes/marine/ChatShell.tsx` |
| Marine presentation | `Sidebar.tsx`, `Messages.tsx`, `Composer.tsx`, `SourcePanel.tsx`, `config.ts` |
| Shared stream | `packages/app/src/lib/hooks/useChatStream.ts` |
| SSE transport/parser | `packages/app/src/lib/agent/chat-client.ts`, `stream-event-processor.ts` |
| Shared types | `packages/app/src/types/chat.ts` |
| Cookie-auth proxy | `apps/agents/src/app/api/agent/[...path]/route.ts` |
| Attachments | Chat attachment route and `packages/app/src/lib/agent/chat-attachments.ts` |
| Documents | shared `HtmlViewer` plus Documents app routes |

## Known implementation limits

- The Marine voice button is presentation-only; it has no input handler.
- Helpful/unhelpful feedback in Marine is local UI state unless separately wired.
- `/chat/demo` contains canned data and simulated streaming.
- Trace tests before relying on them; route imports and mocks can drift during package extraction.

For coordinated work, use [`../guides/chat-multi-agent-work.md`](../guides/chat-multi-agent-work.md).
