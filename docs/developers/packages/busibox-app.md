# busibox-app

**Package:** @jazzmind/busibox-app  
**Location:** packages/app

Shared component library used by all Busibox frontend apps. Published to npm (GitHub Packages).

## Components (56 React components)

- chat/: ChatMessage, ChatInterface, SimpleChatInterface, ChatPage, etc.
- documents/: DocumentCard, DocumentViewer, DocumentUpload, etc.
- insights/: InsightsPanel, etc.
- ui/: Base UI components

## Layout

- Header
- Footer
- ThemeToggle

## Context Providers (4)

- ThemeProvider
- CustomizationProvider
- BusiboxApiProvider

## Service Clients

- DataClient
- AgentClient
- RBACClient
- AuditClient
- SearchClient (Tavily, SerpAPI, Perplexity, Bing)
- EmbeddingsClient

## Types

- SessionData
- NavigationItem
- PortalCustomization
- ChatMessage
- Document
- Workflow types

## Build

Uses TypeScript compiler (tsc). Outputs CJS and ESM with declarations.

## Commands

- `npm run build` - Build
- `npm run dev` - Watch mode
- `npm test` - Run tests
- `npm run type-check` - Type check

## Subpath Exports

- `@jazzmind/busibox-app` - Main entry
- `@jazzmind/busibox-app/lib/auth`
- `@jazzmind/busibox-app/lib/agent`
- `@jazzmind/busibox-app/lib/authz`
- `@jazzmind/busibox-app/lib/audit`
- `@jazzmind/busibox-app/lib/data`
- `@jazzmind/busibox-app/lib/insights`
- `@jazzmind/busibox-app/lib/rbac`
- `@jazzmind/busibox-app/lib/search`
- `@jazzmind/busibox-app/lib/utils`
- `@jazzmind/busibox-app/components`
- `@jazzmind/busibox-app/contexts`
- `@jazzmind/busibox-app/layout`
- `@jazzmind/busibox-app/types`
- `@jazzmind/busibox-app/sso`

## Publishing

`pnpm publish:busibox-app` from monorepo root, or `npm publish` from packages/app. GitHub Action can publish on release.
