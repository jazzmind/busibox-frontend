---
title: "Local Development Setup"
category: "administrator"
order: 1
description: "Local development setup for the busibox-frontend monorepo"
published: true
---

# Local Development Setup

## Developing with Local busibox-app

When developing against a local copy of busibox-app (cloned next to the consuming app):

1. Clone busibox-app next to the consuming app
2. Run `npm run link:local` in the consuming app
3. Run `npm run dev` to start the development server
4. Changes to busibox-app appear after restarting the dev server

## Monorepo Context

In the monorepo context, `packages/app` is the local busibox-app. The pnpm workspace handles resolution automatically. No manual linking is required when working within the monorepo.

## TypeScript Path Mappings

TypeScript path mappings in `tsconfig.json` provide IDE support for imports. These mappings allow the IDE to resolve types and provide IntelliSense when importing from `@jazzmind/busibox-app`.

## Link Commands

- `npm run link:local` - Link to local busibox-app (when developing outside monorepo)
- `npm run link:busibox` - Check current link status
- `npm run unlink:local` - Remove local link and revert to npm package

## Troubleshooting

**Changes not appearing**: Restart the dev server. Changes to busibox-app require a dev server restart to take effect.

**Type errors**: Rebuild busibox-app with `cd packages/app && pnpm run build` (or `npm run build` in standalone busibox-app).

**Verify symlink**: Run `ls -la node_modules/@jazzmind/busibox-app` to confirm the symlink points to the correct path when using link:local.

## Production Builds

Production builds automatically use the npm package when a local link is not available. No special configuration is needed for deployment.

## pnpm Commands

From the monorepo root:

- `pnpm install` - Install all dependencies
- `pnpm dev` - Run all apps in development mode
- `pnpm dev:portal` - Run portal app only
- `pnpm dev:agents` - Run agents app only
- `pnpm dev:admin` - Run admin app only
- `pnpm dev:chat` - Run chat app only
- `pnpm dev:appbuilder` - Run appbuilder app only
- `pnpm dev:media` - Run media app only
- `pnpm dev:documents` - Run documents app only
- `pnpm build` - Build all packages and apps
- `pnpm lint` - Lint all packages
- `pnpm type-check` - Run TypeScript type checking across the monorepo
