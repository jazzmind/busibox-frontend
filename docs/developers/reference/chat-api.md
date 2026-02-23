# Chat API Reference

Chat API reference for the agent-api service. All endpoints require Bearer token authentication via Zero Trust token exchange.

## Endpoints

### Conversations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations` | List conversations. Params: `limit`, `offset` |
| POST | `/conversations` | Create conversation. Body: `title`, `isPrivate` |
| GET | `/conversations/[id]` | Get conversation with messages |
| DELETE | `/conversations/[id]` | Delete conversation |
| GET | `/conversations/[id]/messages` | Get message history. Params: `limit`, `offset` |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat/message/stream` | Send message with SSE streaming. Body: `conversationId`, `content`, `model`, `webSearch`, `docSearch`, `selectedLibraries` |

**Stream events:**
- `message` – content chunk
- `done` – `messageId`
- `error` – error payload

## Data Models

### Conversation

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| ownerId | string | Owner user ID |
| title | string | Conversation title |
| isPrivate | boolean | Private flag |
| createdAt | string | ISO timestamp |
| updatedAt | string | ISO timestamp |

### Message

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| conversationId | string | Parent conversation ID |
| role | string | `user` \| `assistant` \| `system` |
| content | string | Message content |
| webSearchResults | object | Web search results (if applicable) |
| docSearchResults | object | Document search results (if applicable) |
| createdAt | string | ISO timestamp |
| updatedAt | string | ISO timestamp |

## Client Integration

Use the `ChatPage` component from `@jazzmind/busibox-app` with `createAgentClient` for client-side integration.

## Error Format

```json
{
  "error": "string",
  "details": "string"
}
```

**Status codes:** 400, 401, 403, 404, 500
