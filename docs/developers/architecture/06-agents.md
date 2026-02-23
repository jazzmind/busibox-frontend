# Agent Frontend Architecture

## Design Principles

The agents app is a **pure frontend-only** design:

- Displays UI and manages client state
- Makes API calls to backend services
- No database, business logic, or file storage
- All data comes from backend APIs

## API Gateway Pattern

All `app/api/*` routes are proxies to backend services. The agents app never calls agent-api or data-api directly from the browser. Server-side API routes perform token exchange and forward requests with the appropriate audience-bound token.

## High-Level Architecture

```
Agent Client (Next.js, apps/agents)
    |
    | Token exchange via authz
    v
+-------------------+     +-------------------+
| Agent Server      |     | Data API         |
| (FastAPI)         |     | (FastAPI)          |
| agent-lxc:8000    |     | data-lxc:8001      |
+-------------------+     +-------------------+
    |                           |
    v                           v
PostgreSQL, Milvus, MinIO, Redis
```

The Agent Server handles conversations, agents, runs, workflows, and settings. The Data API handles file uploads, text extraction, embedding generation, and semantic search. Both connect to PostgreSQL, Milvus, MinIO, and Redis for persistence and RAG.

## Component Architecture

| Directory | Components | Purpose |
|-----------|------------|---------|
| chat/ | ChatWindow, ChatMessage, ChatInput, MessageList | Chat UI and message display |
| agents/ | AgentCard, AgentList | Agent listing and selection |
| workflow/ | Workflow builder components | Visual workflow design |
| ui/ | Shared UI components | Buttons, modals, forms |

## API Layer

| Route | Backend | Purpose |
|-------|---------|---------|
| /api/chat/* | Agent Server | Chat, message streaming |
| /api/conversations/* | Agent Server | Conversation CRUD |
| /api/agents/* | Agent Server | Agent CRUD |
| /api/upload/* | Data API | File uploads |
| /api/runs/* | Agent Server | Run execution, SSE streaming |
| /api/workflows/* | Agent Server | Workflow CRUD, execution |
| /api/tools/* | Agent Server | Tool configuration |

## Data Flows

### Chat Message Flow

1. User submits input via ChatInput
2. Client sends POST to /api/chat (or equivalent) with conversation context
3. API route exchanges session JWT for agent-api token
4. Request forwarded to Agent Server
5. Agent Server processes (optionally using tools for search, RAG)
6. Response streams back via SSE
7. Client parses SSE events and appends to MessageList
8. Message stored in conversation via Agent Server
9. UI updates with new message and tool results (web search, doc search)

### File Upload Flow

1. User selects file in chat
2. Client validates file type and size
3. POST to /api/upload
4. API route proxies to Data API with token
5. Data API stores file in MinIO, extracts text, generates embeddings
6. File reference attached to message
7. Agent can use RAG search for context

### Agent Execution Flow

1. User selects agent and submits input
2. Dispatcher routes to appropriate agent
3. Run created via Agent Server
4. Pydantic AI executes agent (tools, LLM calls)
5. Output streams via SSE
6. Client displays streamed content
7. Results saved to run/conversation

## Integration with Agent Server API

| Endpoint Category | Purpose |
|-------------------|---------|
| conversations | Create, list, get, update, delete conversations |
| messages | List messages, send message, stream response |
| agents | List, create, update, delete agents |
| runs | Create run, stream run events, get run status |
| settings | Model config, tool config |
| dispatcher | Route requests to agents |

## Integration with Data API

| Endpoint | Purpose |
|----------|---------|
| File upload | Upload file, get presigned URL |
| Text extraction | Extract text from document |
| Embedding generation | Generate embeddings for chunks |
| Semantic search | RAG search over documents |

## Stateless Client

- Auth tokens stored in httpOnly cookies (session JWT)
- All data fetched from backend APIs on demand
- No local persistence of conversations or agents
- Refresh reloads data from APIs

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- React Flow (workflow builder)
