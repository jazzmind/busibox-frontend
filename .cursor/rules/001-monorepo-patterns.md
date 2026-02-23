# Monorepo Patterns

These rules apply to all frontend apps in this repository.

## Structure

- Keep app-specific code in `apps/<app>/`.
- Move cross-app logic to `@jazzmind/busibox-app` (`packages/app`).
- Keep `apps/portal` as a shell app; domain functionality lives in dedicated apps.

## Next.js

- Use App Router conventions and server components by default.
- Use client components only where interactivity is required.
- Keep per-app `NEXT_PUBLIC_BASE_PATH` behavior aligned with nginx routes.

## API Routes

- Keep API handlers small and explicit.
- Reuse shared auth/token helpers from `@jazzmind/busibox-app` instead of duplicating.
- Return consistent error shapes and status codes.

## Components

- Co-locate components with their owning app unless reused by 2+ apps.
- Promote reusable components to `@jazzmind/busibox-app`.
- Keep large pages split into focused components and small utilities.
