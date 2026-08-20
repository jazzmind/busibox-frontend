# Chat API Reference

The Python Agent API exposes the chat contract. Browser code normally reaches it through the Agents app catch-all proxy at `/agents/api/agent/*`; server components can call the internal Agent API directly with an audience-bound token.

## Primary endpoints

| Method | Agent API path | Purpose |
|---|---|---|
| `GET` | `/agents` | List visible agents; Marine selects the active `chat` agent |
| `GET` | `/conversations?limit=&offset=&source=` | List the current user's conversations |
| `POST` | `/conversations` | Create a conversation |
| `GET` | `/conversations/<id>` | Get a conversation with messages |
| `PATCH` | `/conversations/<id>` | Update title/metadata supported by the backend schema |
| `DELETE` | `/conversations/<id>` | Delete a conversation |
| `GET` | `/conversations/<id>/messages` | Paginated message list |
| `GET` | `/chat/<id>/history` | Chat-oriented history response used by the UI |
| `POST` | `/chat/message` | Non-streaming response |
| `POST` | `/chat/message/stream` | Standard SSE response |
| `POST` | `/chat/message/stream/agentic` | Agentic SSE response used by Marine |
| `GET` | `/chat/models` | Selectable chat models |
| `POST` | `/chat/<id>/generate-insights` | Trigger insight generation |
| `POST` | `/chat-attachments` | Create attachment metadata after file processing |
| `GET` | `/chat-attachments/<id>` | Read attachment metadata |
| `DELETE` | `/chat-attachments/<id>` | Delete attachment metadata |

Conversation sharing, settings, messages, insights, agents, runs, tools, tasks, workflows, and eval endpoints also live in the Agent API. Inspect the FastAPI routers in sibling `busibox/srv/agent/app/api` for the current full surface.

## Agentic send request

The shared frontend type is `ChatMessageRequest` in `packages/app/src/types/chat.ts`. Important fields used by Marine are:

- `message`
- `conversation_id`
- `model` (`auto` in the current Marine shell)
- `selected_agents` (the active default Chat agent ID when found)
- `attachment_ids`
- `knowledge_scope` (`all`, `libraries`, or `attachments`)
- `selected_library_ids` (exactly one accessible library ID when the scope is `libraries`)
- `metadata.user_context.timezone` and `metadata.user_context.locale`

The Agent API enforces the administrator's `chat_model_routing_mode` platform setting (`local`, `auto`, or `frontier`). Marine continues to send `model: "auto"` for compatibility, but that browser field cannot override the administrator policy.

Document scope is user-controlled per chat request:

- `all` searches every document the authenticated user can access.
- `libraries` first asks Data API to validate the selected library and resolve its files under RLS, then searches only those server-resolved file IDs.
- `attachments` searches only file IDs linked to the current chat attachments. An empty attachment or library scope returns no document results; it never broadens to all documents.

When changing a field, update the frontend type, request builder, FastAPI schema, route behavior, persistence mapping, and tests as one contract.

## Agentic SSE events

| Event | Meaning |
|---|---|
| `conversation_created` | Backend created a conversation and returned its ID/title |
| `title_update` | Default title was replaced from the first message |
| `thought`, `plan`, `progress` | Dispatcher/agent progress and reasoning metadata |
| `tool_start` | Tool execution began |
| `tool_result` | Tool completed; `document_search` results may contain citations |
| `content`, `content_chunk` | Interim or final assistant text |
| `interim` | Non-final follow-up/status content |
| `clarify_parallel`, `prompt` | A user choice/confirmation is requested |
| `message_complete` | Final assistant message was persisted |
| `complete` | Execution completed |
| `error` | Stream failed |

The shared parser is `packages/app/src/lib/agent/stream-event-processor.ts`. Treat it as the frontend source of truth for supported events.

The dispatcher emits a `thought` with `data.phase: "model_route"` and the effective `routing_mode`/model alias. The persisted assistant `routing_decision` also records `model_routing_mode` and `knowledge_scope`, which makes routing and scope auditable after the stream completes.

## Authentication path

1. Browser sends the `busibox-session` cookie to `/agents/api/agent/*`.
2. The Agents app proxy exchanges it for an `agent-api` token.
3. The proxy forwards `Authorization: Bearer <token>` to FastAPI.
4. FastAPI resolves the `Principal` and applies user/ownership checks.

Do not send an internal service URL or reusable Agent API token to the browser.
