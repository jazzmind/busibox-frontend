# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor AI when working with code in this repository.

## Project Overview

**Busibox Agents** is a Next.js frontend application for managing and interacting with AI agents in the Busibox infrastructure. It provides agent management, chat interface with intelligent routing, workflow building, and real-time execution monitoring.

**Key Architecture**: Pure frontend application with no database access. All data operations go through backend APIs (Agent Server, Data API, AuthZ Service).

## Quick Start

### Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage

# Linting
npm run lint
```

### Environment Setup

```bash
cp env.example .env.local
# Edit .env.local with your settings
```

### Deployment

**From Busibox Admin Workstation**:
```bash
cd /path/to/busibox/provision/ansible

# Deploy to production:
make deploy-busibox-agents

# Deploy to test environment:
make deploy-busibox-agents INV=inventory/test
```

## Architecture

### Tech Stack

- **Framework**: Next.js 16.0.10 (App Router with Turbopack)
- **UI**: React 19.2.3, TypeScript 5, Tailwind CSS 4
- **APIs**: Agent Server (agent-lxc:8000), Data API (data-lxc:8001), AuthZ Service (authz-lxc:8010)
- **Deployment**: PM2, nginx (apps-lxc container), Ansible automation

### Project Structure

```
busibox-agents/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin pages
│   ├── agent/[id]/        # Agent detail views
│   ├── agents/            # Agent listing
│   ├── api/               # API routes (38 routes)
│   │   ├── admin/         # Admin API routes
│   │   ├── agents/        # Agent CRUD
│   │   ├── auth/          # Authentication
│   │   ├── chat/          # Chat functionality
│   │   ├── conversations/ # Conversation management
│   │   ├── runs/          # Agent run management
│   │   ├── tools/         # Tool configuration
│   │   └── workflows/     # Workflow execution
│   ├── simulator/         # Agent chat simulator
│   ├── tools/             # Tool management pages
│   └── workflows/         # Workflow builder pages
├── components/            # React components
│   ├── admin/            # 9 admin components
│   ├── agents/           # Agent components
│   ├── chat/             # 11 chat components
│   ├── conversations/    # Conversation components
│   ├── tools/            # Tool components
│   └── workflow/         # Workflow builder components
├── hooks/                # React hooks
│   ├── useChatMessages.ts
│   └── useRunStream.ts
├── lib/                  # Utilities and API clients
├── docs/                 # Documentation
│   ├── architecture/     # System design
│   ├── deployment/       # Deploy guides
│   └── development/      # Dev workflows
├── specs/                # Specifications (for speckit)
└── test/                 # Test setup
```

### Key Principles

**1. No Direct Database Access**: All data operations go through backend APIs:
- Agent Server API for conversations, agents, runs, workflows
- Data API for file uploads, RAG search

**2. Zero Trust Authentication**: 
- Session JWT from Busibox Portal
- Token exchange with AuthZ Service
- Audience-bound tokens for each backend service

**3. Pure Frontend**: 
- No business logic in frontend
- No file storage
- Stateless design

## Key Features

### 1. Agent Management
- Create and configure AI agents
- Edit agent prompts and settings
- View agent performance

### 2. Chat Interface
- Interactive chat with agents
- Real-time SSE streaming for responses
- File upload support for RAG

### 3. Workflow Builder
- Visual workflow designer
- Workflow execution and monitoring
- Step-by-step execution tracking

### 4. Tool Management
- Configure agent tools
- Test tool functionality
- Manage tool permissions

### 5. Agent Simulator
- Test agents in isolation
- Debug agent behavior
- Session management

## API Routes

The application proxies requests to backend services:

| Route Pattern | Backend | Purpose |
|--------------|---------|---------|
| `/api/agents/*` | Agent Server | Agent CRUD operations |
| `/api/conversations/*` | Agent Server | Conversation management |
| `/api/runs/*` | Agent Server | Agent run execution |
| `/api/chat/*` | Agent Server | Chat functionality |
| `/api/tools/*` | Agent Server | Tool configuration |
| `/api/workflows/*` | Agent Server | Workflow execution |
| `/api/upload/*` | Data API | File uploads |
| `/api/admin/*` | Agent Server | Admin operations |

## Development Workflow

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes and test locally**:
   ```bash
   npm run dev
   # Test in browser at http://localhost:3000
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

4. **Commit and push**:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature
   ```

### Adding a New Feature

1. **Plan the feature**:
   - Determine required API routes
   - Design UI components
   - Identify backend dependencies

2. **Create API routes** (if needed):
   ```typescript
   // app/api/your-feature/route.ts
   export async function GET(request: Request) {
     // Proxy to backend API
   }
   ```

3. **Create components**:
   ```typescript
   // components/your-feature/YourComponent.tsx
   export function YourComponent() {
     // Implementation
   }
   ```

4. **Add pages**:
   ```typescript
   // app/your-feature/page.tsx
   export default function YourFeaturePage() {
     // Implementation
   }
   ```

## Environment Variables

```bash
# Backend APIs
NEXT_PUBLIC_AGENT_API_URL=http://10.96.201.202:8000  # Agent Server
NEXT_PUBLIC_DATA_API_URL=http://10.96.201.206:8001  # Data API

# Authentication
AUTHZ_BASE_URL=http://10.96.200.210:8010  # AuthZ Service

# Busibox Portal (SSO)
NEXT_PUBLIC_BUSIBOX_PORTAL_URL=http://10.96.201.201:3000

# Application
PORT=3001
NEXT_PUBLIC_BASE_PATH=/agents
```

See `env.example` for complete configuration and [Development Setup](./docs/development/setup.md) for details.

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Manual Testing

1. **Agent Creation**:
   - Create new agent
   - Configure prompts
   - Test with simulator

2. **Chat Flow**:
   - Start conversation
   - Send messages
   - Verify streaming responses

3. **Workflow Builder**:
   - Create workflow
   - Execute workflow
   - Monitor execution

## Integration with Busibox

Busibox Agents is deployed and managed through the Busibox infrastructure:

### Service Dependencies

- **Agent Server** (agent-lxc): Agent operations, conversations
- **Data API** (data-lxc): File uploads, RAG search
- **Apps Container** (apps-lxc): Hosts the Next.js application

### Deployment Flow

1. **Code Changes**: Pushed to GitHub
2. **Busibox Ansible**: Pulls changes and deploys
3. **Apps Container**: Runs the application with PM2
4. **Proxy Container**: Routes traffic via nginx

## Best Practices

### Code Style

- Use TypeScript for type safety
- Follow Next.js App Router conventions
- Use Server Components by default, Client Components when needed
- Keep components small and focused
- Use Tailwind CSS for styling

### API Routes

- All API routes should proxy to backend services
- Handle errors gracefully
- Add proper typing for request/response

### Components

- Prefer composition over inheritance
- Use React Server Components where possible
- Implement proper loading states
- Handle error states

## Troubleshooting

### Connection Issues

```bash
# Check Agent Server health
curl http://agent-lxc:8000/health

# Check Data API health
curl http://data-lxc:8001/health
```

### Build Issues

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### PM2 Issues (on apps-lxc)

```bash
pm2 list                    # Check status
pm2 logs busibox-agents       # View logs
pm2 restart busibox-agents    # Restart app
```

## Documentation

Complete documentation is in the `/docs` directory:

- **[Documentation Index](./docs/README.md)** - Complete documentation hub
- **[Architecture Overview](./docs/architecture/overview.md)** - System design
- **[Development Setup](./docs/development/setup.md)** - Local development
- **[Deployment Guide](./docs/deployment/deployment-guide.md)** - Deployment procedures
- **[Authentication Guide](./docs/guides/AUTHENTICATION.md)** - Auth flow details
- **[Specifications](./specs/)** - Feature specifications

## Related Projects

- **Busibox**: Infrastructure and deployment
- **Busibox Portal**: Main dashboard application
- **Busibox-App**: Shared component library
- **Agent Server**: Backend agent service (Python FastAPI)

## Important Notes

1. **No Database Access**: This app only calls APIs, never accesses databases directly
2. **Zero Trust Auth**: Uses token exchange for each backend service
3. **SSE Streaming**: Agent responses use Server-Sent Events for real-time updates
4. **Deployment**: Always deploy to test environment first via Ansible
5. **PM2**: Application runs under PM2 on apps-lxc container
6. **Port**: Runs on port 3001 (not 3000 like Busibox Portal)
7. **Base Path**: Served at `/agents` path through nginx proxy
