# Busibox Frontend

The frontend monorepo for [Busibox](https://github.com/jazzmind/busibox) — a self-hosted AI platform for document processing, semantic search, AI agents, and custom applications.

This repo contains every user-facing application in the platform: the portal, agent manager, admin dashboard, chat interface, app builder, media tools, and document library. They share a common component library, authentication system, and deployment pipeline.

## Applications

Seven Next.js apps run independently behind nginx, each at its own path and port:

| App | Path | Port | What It Does |
|-----|------|------|-------------|
| **Portal** | `/portal` | 3000 | Shell app — auth, home dashboard, docs, account, setup |
| **Agents** | `/agents` | 3001 | Agent management, workflow builder, chat simulation |
| **Admin** | `/admin` | 3002 | User management, roles, settings, deployments |
| **Chat** | `/chat` | 3003 | AI chat interface with RAG, web search, file attachments |
| **App Builder** | `/builder` | 3004 | AI-assisted app creation and deployment |
| **Media** | `/media` | 3005 | Video generation and media management |
| **Documents** | `/documents` | 3006 | Document libraries, upload, processing, search |

## Shared Packages

| Package | Location | Purpose |
|---------|----------|---------|
| `@jazzmind/busibox-app` | `packages/app` | Shared component library — SSO auth, API clients, chat components, search, theming, layout |
| `@busibox/tsconfig` | `packages/tsconfig` | Shared TypeScript configurations |

All cross-app logic (auth, API clients, embeddings, UI components) lives in `@jazzmind/busibox-app`. App-specific code stays inside the app unless it's reused by at least two apps.

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- `GITHUB_AUTH_TOKEN` environment variable with `read:packages` scope (for `@jazzmind` packages)

### Development

```bash
# Install all dependencies
pnpm install

# Run all apps in development mode
pnpm dev

# Run a specific app
pnpm dev:portal
pnpm dev:agents
pnpm dev:admin
pnpm dev:chat
pnpm dev:appbuilder
pnpm dev:media
pnpm dev:documents

# Build, lint, type-check, test
pnpm build
pnpm lint
pnpm type-check
pnpm test
```

### Environment

Each app has its own `.env.local`. Copy the app's `env.example` and fill in the values. The monorepo root `.npmrc` configures GitHub Packages authentication.

## Architecture

This is a **Turborepo + pnpm** monorepo. All apps are Next.js 16 with React 19, TypeScript 5, and Tailwind CSS 4.

```
busibox-frontend/
├── apps/
│   ├── portal/         # Shell app (auth, home, docs, account, setup)
│   ├── agents/         # Agent management and chat
│   ├── admin/          # Admin dashboard (users, roles, settings, deploy)
│   ├── chat/           # AI chat interface
│   ├── appbuilder/     # AI app builder
│   ├── media/          # Video generation and media
│   └── documents/      # Document libraries and management
├── packages/
│   ├── app/            # @jazzmind/busibox-app (shared library)
│   └── tsconfig/       # @busibox/tsconfig (shared TS configs)
└── docs/               # Documentation (by audience)
    ├── developers/     #   Architecture, APIs, per-app docs, packages
    ├── administrators/ #   Deployment, config, testing, troubleshooting
    └── users/          #   Feature guides (chat, documents, video, auth)
```

### How It Connects to Busibox

The frontend apps don't access databases directly. They authenticate via Zero Trust token exchange through the AuthZ service, then proxy requests to backend APIs:

| Backend Service | What It Provides |
|----------------|-----------------|
| **AuthZ** | SSO, token exchange, RBAC |
| **Agent API** | Agent operations, conversations, streaming |
| **Data API** | Document CRUD, file uploads, structured data |
| **Search API** | Hybrid search (vector + keyword + graph) |
| **Deploy API** | App deployment and management |

All backend services run in the [busibox](https://github.com/jazzmind/busibox) infrastructure repo. See the [architecture docs](docs/developers/architecture/00-overview.md) for the full picture.

## Deployment

Apps are deployed via Ansible to the Busibox `core-apps` container. Each app runs as a separate Node.js process under PM2 behind nginx.

```bash
# From the busibox repo root:
make install SERVICE=core-apps          # Deploy all frontend apps
make manage SERVICE=core-apps ACTION=status   # Check status
make manage SERVICE=core-apps ACTION=logs     # View logs
```

### Development Modes (Docker)

In local Docker, the `core-apps` container supports two modes:

- `CORE_APPS_MODE=dev` — hot reload for all 7 apps
- `CORE_APPS_MODE=prod` — build once, run standalone servers (lower memory)

Configured in the busibox infrastructure repo via `docker-compose.local-dev.yml`.

## Publishing

`@jazzmind/busibox-app` is the shared library consumed by all busibox apps (including apps outside this monorepo like [busibox-template](https://github.com/jazzmind/busibox-template)).

```bash
pnpm publish:busibox-app    # Publish to GitHub Packages
```

Also available via the GitHub Action in `.github/workflows/publish-busibox-app.yml`.

## Documentation

| Audience | Location | Content |
|----------|----------|---------|
| **Developers** | [docs/developers/](docs/developers/) | Architecture, APIs, per-app docs, package docs |
| **Administrators** | [docs/administrators/](docs/administrators/) | Local dev, deployment, config, testing, troubleshooting |
| **Users** | [docs/users/](docs/users/) | Chat, documents, video generation, authentication |

See [docs/README.md](docs/README.md) for the full structure.
