# Agents

**Package:** @busibox/agents  
**Port:** 3001  
**Base path:** /agents

## Purpose

Manage AI agents, chat with agents, build workflows, configure tools, and run the agent simulator. Pure frontend application with no direct database access.

## Routes

- `/agents` - Agent list
- `/agent/[id]` - Agent detail
- `/simulator` - Agent simulator
- `/workflows` - Workflow builder
- `/tools` - Tool management
- `/evals` - Evaluations
- `/tasks` - Tasks
- `/admin` - Admin pages
- `/new` - New agent
- `/api/*` - 38 proxy routes to backend services

## Architecture

All API routes proxy to backend services:
- agent-server (FastAPI, port 8000)
- data-api (port 8001)

No direct database access.

## Key Components

- chat/ (11 components)
- agents/
- workflow/
- tools/
- conversations/

## Hooks

- useChatMessages
- useRunStream

## API Proxy Routes

- /api/agents
- /api/conversations
- /api/chat
- /api/runs
- /api/tools
- /api/workflows
- /api/upload

## Tech Stack

- Next.js 16
- React Flow (workflows)
- Tailwind CSS 4
