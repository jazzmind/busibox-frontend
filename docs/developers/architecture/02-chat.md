# Chat System Architecture

## Overview

The chat system uses a Server Component architecture with Zero Trust auth. The chat page is a Server Component that validates the session, exchanges for an agent-api token, and renders the chat UI with an authenticated agent client.

## Component Hierarchy

```
Chat Page (Server Component)
└── busibox-app ChatPage
    ├── ConversationSidebar
    ├── ChatInterface
    │   ├── MessageList
    │   ├── MessageInput
    │   └── ToolSelectors
    └── InsightsPanel
```

## Data Models

**Conversation**

- id, ownerId, title, isPrivate, messages

**Message**

- id, conversationId, role, content, webSearchResults, docSearchResults

**Attachment**

- File metadata and references for uploaded documents

## Auth Flow

1. Session validation via authz.
2. Token exchange for agent-api audience.
3. Agent client creation with the exchanged token.
4. Client used for conversation CRUD, message streaming, and tool calls.

## Features

- Conversation CRUD (create, list, update, delete)
- Message streaming via SSE
- Markdown, code, and math rendering (KaTeX)
- Web search (via agent tools)
- Document search (via agent tools)
- Library selection for document context

## Integration Points

| Service | Role |
|---------|------|
| AuthZ | Session validation, token exchange for agent-api |
| Agent API | Conversations, messages, streaming, tool orchestration |
| Search API | Invoked by agent for web search |
| Data Service | Invoked by agent for document/RAG search |

## Agent API URL Resolution

The agent client resolves the API URL in this order:

1. `AGENT_API_URL` (if set)
2. `AGENT_HOST:AGENT_API_PORT` (if both set)
3. `localhost` (fallback for local development)

## Data Flow

1. User submits input via MessageInput.
2. Client sends POST to agent-api with conversation context.
3. Agent processes the request (optionally using tools for search, RAG).
4. Response streams back via SSE.
5. Message is stored in the conversation.
6. UI updates with the new message and any tool results (web search, doc search).
