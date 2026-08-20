---
title: "Chat Multi-Agent Development Guide"
category: "developer"
order: 20
description: "Ownership, workflow, route seams, and verification for coordinated Chat work across busibox-frontend and busibox."
published: true
---

# Chat Multi-Agent Development Guide

Use this guide when a change crosses the Chat UI, shared frontend package, Agents proxy, Agent API, document APIs, or deployment configuration. The detailed runtime map is in [`../architecture/02-chat.md`](../architecture/02-chat.md); the sibling backend guide is `../busibox/docs/developers/guides/chat-backend-development.md` in a side-by-side checkout.

## Start every work session safely

Run these checks in both `busibox-frontend` and `busibox` before assigning work:

```bash
git status --short --branch
git fetch --all --prune
git rev-list --left-right --count HEAD...origin/main
git log --oneline --decorate -12
```

Do not reset a dirty checkout. If upstream moved, first compare the upstream file list with the locally modified file list. Use a clean worktree or prove that the local patch applies before fast-forwarding a dirty checkout.

## Recommended ownership lanes

| Lane | Primary files | Avoid changing |
|---|---|---|
| Marine presentation | `apps/chat/src/components/chat/themes/marine/*`, `apps/chat/src/app/globals.css` | Shared transport and backend behavior |
| Chat page/auth composition | `apps/chat/src/app/(authenticated)/*`, `apps/chat/src/app/layout.tsx` | Agents proxy internals |
| Shared chat transport | `packages/app/src/lib/hooks/useChatStream.ts`, `packages/app/src/lib/agent/*`, `packages/app/src/types/chat.ts` | Marine layout unless required |
| Browser proxy/auth | `apps/agents/src/app/api/agent/[...path]/route.ts`, shared auth helpers | FastAPI business logic |
| Attachment BFF | `apps/chat/src/app/api/chat/conversations/[id]/attachments/route.ts`, `packages/app/src/lib/agent/chat-attachments.ts` | Document viewer UI |
| Backend chat | sibling `busibox/srv/agent/app/api/chat.py`, dispatcher/agent/tool services | Frontend styling |
| Citation/document rendering | `MarineSourcePanel`, `CitationPreview`, `HtmlViewer`, Documents routes | Dispatcher/model routing |
| Verification/docs | focused tests and these docs | Product behavior unless a test exposes a defect |

One agent should own the shared contracts when a change alters request fields, SSE event shapes, stored message fields, or citations. Other agents should consume that contract rather than editing both ends independently.

## File collision hotspots

Coordinate before editing any of these:

- `apps/chat/src/components/chat/themes/marine/ChatShell.tsx`
- `packages/app/src/lib/hooks/useChatStream.ts`
- `packages/app/src/lib/agent/stream-event-processor.ts`
- `packages/app/src/types/chat.ts`
- `apps/agents/src/app/api/agent/[...path]/route.ts`
- `busibox/srv/agent/app/api/chat.py`
- `busibox/srv/agent/app/services/agentic_dispatcher.py`
- `busibox/srv/agent/app/agents/chat_agent.py`

## Contract-first change sequence

1. Write down the browser request path, backend endpoint, request fields, SSE events, persistence fields, and UI states affected.
2. Assign the backend contract and frontend consumption to explicit owners.
3. Implement the smallest vertical slice. Keep compatibility mapping for snake_case backend fields and camelCase frontend types where current code already supports both.
4. Test pure stream/event mapping before browser testing.
5. Test the Next.js proxy with cookie auth; direct calls to FastAPI do not prove the browser path.
6. Test persistence by reloading the conversation; streaming output alone does not prove stored-history rendering.
7. Test attachments and citations through the Documents app, not with fabricated IDs.

## Verification matrix

| Change | Minimum source checks | Runtime proof |
|---|---|---|
| Marine-only visual change | Chat lint/build plus component review | Authenticated `/chat` at desktop and narrow width |
| Conversation CRUD | Chat tests/build; inspect proxy and FastAPI handlers | Create, select, reload, delete; URL and sidebar remain consistent |
| SSE rendering | Stream processor tests and Chat build | Intermediate content appears before completion; Stop cancels; final history survives reload |
| Tool/thinking UI | Event processor plus backend route/dispatcher tests | `thought`, `tool_start`, `tool_result`, content, completion order from a real request |
| Attachments | Attachment BFF tests plus Agent API attachment tests | Upload, ready/error state, send, reload, and backend attachment metadata |
| Citations | Stream processor and history mapping checks | Live source chip, reload source chip, document panel HTML/status/download |
| Model selection | Frontend model client and backend model-selector tests | Selected model reaches backend and a real completion succeeds |
| Auth/proxy | Proxy/auth tests | Expired/missing session returns 401; valid session streams through `/agents/api/agent` |

Never label source presence, compilation, `/chat/demo`, or a non-streaming API call as end-to-end Chat proof.

## Recent change line to understand

The July 2026 interface work introduced an environment-gated Cashman theme, then added debug mode, dark-mode/sidebar polish, delete behavior, attachments, citations, and citation placeholders. Commit `90d9dfe` renamed that theme to Marine and moved tenant copy behind `NEXT_PUBLIC_CHAT_*` variables. Upstream commit `fe5d90f` later removed the hardcoded `source="marine-chat"`, so the current Marine shell does not automatically isolate its conversation list by source.

The sibling `busibox` main branch added `NEXT_PUBLIC_CHAT_BRAND: "marine"` to the Chat app deployment configuration in `ede5beae`. A fetched `origin/Busibox-Chat` branch exists, but it is not main and must not be treated as deployed behavior without an explicit merge/deployment decision.

## Handoff format

Each agent should return:

- Files changed and contract assumptions.
- Commands run and exact results.
- What was only source/build verified.
- What was browser/API/persistence verified.
- Remaining cross-repo dependency or owner.
- Any uncommitted pre-existing files deliberately preserved.
