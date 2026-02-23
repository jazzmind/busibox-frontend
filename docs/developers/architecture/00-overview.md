# Architecture Overview

## Monorepo Structure

The busibox-frontend monorepo uses Turborepo with pnpm workspaces. All apps and packages live under a single repository with shared tooling and dependencies.

```
busibox-frontend/
├── apps/           # Next.js applications
├── packages/       # Shared packages
├── docs/           # Documentation
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Applications

Seven Next.js apps run independently with separate base paths and ports:

| App | Port | Base Path | Purpose |
|-----|------|-----------|---------|
| portal | 3000 | /portal | Shell app: auth, home, docs, account, setup |
| admin | 3002 | /admin | Admin dashboard: settings, users, deployments |
| agents | 3001 | /agents | Agent management and chat |
| chat | 3003 | /chat | AI chat interface |
| appbuilder | 3004 | /builder | Visual app builder |
| media | 3005 | /media | Video generation |
| documents | 3006 | /documents | Document libraries and management |

Portal is the shell app. It handles authentication, the home dashboard, documentation, account management, and setup. Domain apps (admin, chat, documents, media) run independently and are accessed via their own base paths and ports.

## Shared Packages

Three packages provide cross-app logic:

| Package | Location | Purpose |
|---------|----------|---------|
| @jazzmind/busibox-app | packages/app | Shared components, service clients (IngestClient, AgentClient, RBACClient, etc.) |
| @jazzmind/busibox-app | packages/app | Shared components, auth, API clients, embeddings |
| @busibox/tsconfig | packages/tsconfig | Shared TypeScript configurations |

## App Structure Patterns

Apps admin, chat, documents, media, and portal share a similar structure. They were extracted from a monolithic portal and follow consistent patterns for layout, auth, and API proxying.

Agents and appbuilder have unique structures. Agents focuses on agent management, workflow building, and chat simulation. Appbuilder provides a visual app-building experience with different routing and component organization.

## Authentication and Data Access

All apps use Zero Trust authentication via the authz service. No app stores or validates credentials directly.

- **Admin app**: Uses Prisma for direct database access to portal-specific data (users, deployments, settings). Still uses authz for session validation and RBAC.
- **All other apps**: No direct database access. They proxy to backend services using audience-bound tokens obtained via token exchange.

Agents is a pure frontend app. It proxies all requests to agent-server (agent-api) and ingest-api. No database, file storage, or business logic runs in the agents app.

## Backend Services

| Service | Stack | Container | Purpose |
|---------|-------|-----------|---------|
| agent-api | FastAPI | agent-lxc | Agent operations, conversations, streaming |
| ingest-api | FastAPI | data-lxc | File uploads, parsing, embeddings |
| authz | Custom | authz-lxc:8010 | Session management, token exchange, RBAC |
| data-api | FastAPI | data-lxc:8002 | Structured data storage, document CRUD |

## Deployment

Apps are deployed to the apps-lxc container via Ansible. Each app runs under PM2. nginx acts as the reverse proxy, routing requests by path to the appropriate app process.
