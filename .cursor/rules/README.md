# Busibox Frontend Cursor Rules

This monorepo uses app boundaries and shared package boundaries:

- `apps/*`: product surfaces and app-specific API routes/components
- `packages/shared`: shared auth/middleware/api clients
- `packages/ui`: shared UI components
- `packages/app`: published package `@jazzmind/busibox-app`

## Monorepo Guidelines

1. Do not duplicate cross-app logic in multiple apps. Move it to `packages/shared` or `packages/ui`.
2. Keep `apps/portal` as a shell app; route domain-specific functionality to dedicated apps.
3. Use `workspace:*` for internal dependencies between apps/packages.
4. When adding new shared packages, update:
   - `pnpm-workspace.yaml`
   - consuming app dependencies
   - `transpilePackages` in relevant Next.js configs
5. Verify with monorepo commands from root (`pnpm build`, `pnpm type-check`) before claiming completion.
