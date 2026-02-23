# Busibox Frontend Documentation

## Organization

Documentation is organized by **audience**, following the same pattern as the [busibox infrastructure docs](../../../busibox/docs/).

```
docs/
  README.md              # This file
  developers/            # Architecture, API guides, reference, per-app docs
  administrators/        # Configuration, deployment, testing, troubleshooting
  users/                 # End-user feature guides
```

### developers/

For people who build on or contribute to the busibox-frontend monorepo.

```
developers/
  architecture/          # System design (00-overview through 07-workflows)
  reference/             # API specs, env vars, quick lookups
  apps/                  # Per-app docs (portal, admin, agents, etc.)
  packages/              # Shared package docs (busibox-app, shared)
  proposals/             # Active design proposals
```

### administrators/

For people who deploy, configure, and operate the frontend apps.

1. **Local Development** -- developing with local busibox-app
2. **Deployment** -- deploying apps via Ansible
3. **Ingestion Settings** -- document processing configuration
4. **Portal Customization** -- branding and appearance
5. **Testing** -- test strategy and test runner
6. **Troubleshooting** -- common issues and fixes

### users/

For end users of the platform.

1. **Chat** -- using the AI chat interface
2. **Documents** -- document management guide
3. **Video Generation** -- creating videos with Sora-2
4. **Authentication** -- TOTP and passkey setup

## File Conventions

- **Filenames**: Use `kebab-case.md`
- **Numbered files**: Use `NN-name.md` for ordered sequences
- **No historical content**: Session notes, migration summaries, and one-time fix logs do not belong here
- **Keep current**: If a doc describes something that no longer exists, delete it

## Monorepo Overview

```
busibox-frontend/
├── apps/
│   ├── portal/       # Shell app: auth, home, docs, account, setup (port 3000)
│   ├── admin/        # Admin dashboard: settings, users, deployments (port 3002)
│   ├── agents/       # Agent management and chat (port 3001)
│   ├── chat/         # AI chat interface (port 3003)
│   ├── appbuilder/   # Visual app builder (port 3004)
│   ├── media/        # Video generation and media (port 3005)
│   └── documents/    # Document libraries and management (port 3006)
├── packages/
│   ├── app/          # @jazzmind/busibox-app shared library
│   ├── app/          # @jazzmind/busibox-app shared components, auth, API clients
│   └── tsconfig/     # Shared TypeScript configs
└── docs/             # This documentation (unified)
```
