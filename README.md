# Busibox Frontend Monorepo

A Turborepo + pnpm monorepo containing all Busibox frontend applications and shared packages.

## Structure

```
busibox-frontend/
├── apps/
│   ├── portal/         # Main dashboard shell (home, login, docs, account) - port 3000
│   ├── agents/         # Agent management UI - port 3001
│   ├── admin/          # Admin panel (users, roles, settings, deploy) - port 3002
│   ├── chat/           # Chat interface - port 3003
│   ├── appbuilder/     # AI app builder - port 3004
│   ├── media/          # Video generation and media - port 3005
│   └── documents/      # Document management - port 3006
├── packages/
│   ├── app/            # @jazzmind/busibox-app (shared component library)
│   ├── shared/         # @busibox/shared (auth middleware, API clients)
│   └── tsconfig/       # @busibox/tsconfig (shared TS configs)
└── docs/               # Unified documentation (see docs/README.md)
```

## Getting Started

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

# Build all apps
pnpm build

# Publish @jazzmind/busibox-app to GitHub Packages
pnpm publish:busibox-app
```

## Prerequisites

- Node.js >= 20
- pnpm >= 10
- `GITHUB_AUTH_TOKEN` environment variable with `read:packages` scope

## Environment Setup

Each app has its own `.env.local`. See each app's `env.example` for required variables.

The monorepo root `.npmrc` configures GitHub Packages authentication for `@jazzmind` packages.

## Deployment

Apps are deployed via Ansible to the Busibox `core-apps` container. Each app runs as a separate
Node.js process behind nginx at its own path:

| App | Path | Port |
|-----|------|------|
| portal | /portal | 3000 |
| agents | /agents | 3001 |
| admin | /admin | 3002 |
| chat | /chat | 3003 |
| appbuilder | /builder | 3004 |
| media | /media | 3005 |
| documents | /documents | 3006 |

## Core Developer Mode

In local Docker, `core-apps` supports two modes:

- `CORE_APPS_MODE=dev`: hot reload for all 7 apps
- `CORE_APPS_MODE=prod`: build once, run standalone servers for lower memory usage

This is configured in the Busibox infrastructure repo via `docker-compose.local-dev.yml` and
`provision/docker/core-apps-entrypoint-monorepo.sh`.
