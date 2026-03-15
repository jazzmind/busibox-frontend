# CLAUDE.md

Guidance for AI coding agents working in `busibox-frontend`.

## Repository Overview

`busibox-frontend` is a Turborepo + pnpm monorepo containing:

- Next.js apps in `apps/` (`portal`, `agents`, `admin`, `chat`, `appbuilder`, `media`, `documents`)
- Shared packages in `packages/` (`@jazzmind/busibox-app`, `@busibox/tsconfig`). All shared auth, API clients, embeddings, and UI components live in `@jazzmind/busibox-app`.

## Core Commands

Run from repository root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm type-check
pnpm test
```

Run a single app:

```bash
pnpm dev:portal
pnpm dev:agents
pnpm dev:admin
pnpm dev:chat
pnpm dev:appbuilder
pnpm dev:media
pnpm dev:documents
```

## Architecture Notes

- `apps/portal` is the shell app (auth, home, docs, account, setup) and no longer hosts domain-heavy admin/chat/media/documents experiences.
- Domain apps run independently with separate base paths and ports:
  - `/portal` (3000), `/agents` (3001), `/admin` (3002), `/chat` (3003), `/builder` (3004), `/media` (3005), `/documents` (3006)
- All shared cross-app logic (auth, API clients, embeddings, UI components) belongs in `packages/app` (`@jazzmind/busibox-app`)

## Package Publishing

- `@jazzmind/busibox-app` lives at `packages/app`.
- Publish via `pnpm publish:busibox-app` from root or the GitHub Action in `.github/workflows/publish-busibox-app.yml`.

## Documentation

All documentation lives in `docs/` at the monorepo root, organized by audience:

- `docs/developers/` -- architecture, API reference, per-app docs, package docs, proposals
- `docs/administrators/` -- local development, deployment, configuration, testing, troubleshooting
- `docs/users/` -- feature guides (chat, documents, video generation, authentication)

See `docs/README.md` for the full structure.

## Rules of Thumb

- Prefer imports through workspace packages over app-to-app deep imports.
- Keep app-specific code inside the app unless it is reused by at least two apps.
- Keep Next.js `transpilePackages` aligned with workspace dependencies used by each app.
