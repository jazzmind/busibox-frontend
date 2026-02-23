# Agent Manager

Next.js frontend for managing and interacting with AI agents in the Busibox infrastructure.

## Quick Start

```bash
npm install
cp env.example .env.local
npm run dev
```

Visit `http://localhost:3001`

## Documentation

See the unified docs at the monorepo root:

- **[Agents Architecture](../../docs/developers/architecture/06-agents.md)** - System design and principles
- **[Agents App Guide](../../docs/developers/apps/agents.md)** - App-specific reference
- **[Deployment Guide](../../docs/administrators/02-deployment.md)** - Deploy to production

## Key Features

- ✅ **Agent Management** - Create and configure AI agents
- ✅ **Chat Interface** - Interactive chat with intelligent routing
- ✅ **File Upload** - Upload documents for RAG search
- ✅ **Real-Time Updates** - SSE streaming for agent runs
- ✅ **Workflow Builder** - Visual workflow designer with execution monitoring

## Architecture

```
Agent Manager (Frontend Only)
  ├── Calls Agent Server API (conversations, agents, runs, workflows)
  ├── Calls Data API (file uploads, RAG search)
  └── Calls AuthZ Service (authentication, token exchange)
```

**Key Principles**: 
- No direct database access
- Zero Trust authentication
- All data operations via backend APIs

## Tech Stack

- **Framework**: Next.js 15.5 (App Router)
- **UI**: React 19, TypeScript 5, Tailwind CSS 4
- **APIs**: Agent Server, Data API
- **Deployment**: PM2, nginx (apps-lxc container)

## Development

```bash
npm run dev          # Start development server
npm test             # Run tests
npm run build        # Build for production
npm start            # Start production server
```

## Project Structure

```
agent-manager/
├── app/              # Next.js app directory
│   ├── api/          # API routes (proxies to backend)
│   ├── chat/         # Chat interface pages
│   └── agents/       # Agent management pages
├── components/       # React components
├── lib/              # Utilities and API clients
├── specs/            # Specifications (for speckit)
└── specs/            # Specifications (for speckit)
```

## Environment Variables

```bash
# Agent Server API
NEXT_PUBLIC_AGENT_API_URL=http://agent-lxc:8000

# Data API
NEXT_PUBLIC_DATA_API_URL=http://data-lxc:8001
```

See [`env.example`](./env.example) for complete configuration.

## Development

```bash
npm run dev          # Start development server
npm test             # Run tests
npm run build        # Build for production
npm start            # Start production server
```

See [Local Development](../../docs/administrators/01-local-development.md) for complete instructions.

## Support

- **Documentation**: [`docs/`](../../docs/README.md) (monorepo root)
- **Busibox Docs**: See main Busibox repository
- **Issues**: See main Busibox repository

## License

Part of the Busibox project.

---

**Status**: ✅ Production Ready  
**Version**: 0.1.0  
**Last Updated**: 2026-01-19
