# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor AI when working with code in this repository.

## Project Overview

**Busibox App Template** is a Next.js 16 application template designed for rapid development of apps that integrate with the Busibox infrastructure. All data storage uses the Busibox data-api service - no direct database access.

**Key Architecture**: Frontend app with data-api for storage, agent-api for AI, and authz for authentication. No Prisma or direct database access.

## Quick Start

### Development Commands

```bash
# Install dependencies
npm install

# Run development server (port 3002)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Testing
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage

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
make install SERVICE=<app-name>

# Deploy to staging:
make install SERVICE=<app-name> INV=inventory/staging
```

## Architecture

### Tech Stack

- **Framework**: Next.js 16 (App Router with Turbopack)
- **UI**: React 19, TypeScript 5, Tailwind CSS 4
- **Storage**: Busibox data-api (no direct database access)
- **Auth**: Busibox SSO via authz service (JWKS/RS256)
- **Shared Components**: @jazzmind/busibox-app
- **Deployment**: PM2, nginx (apps-lxc container), Ansible

### Project Structure

```
busibox-template/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── health/        # Health check
│   │   ├── session/       # Session management
│   │   └── sso/           # SSO callback
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   ├── globals.css        # Tailwind CSS
│   ├── providers.tsx      # Client providers
│   └── app-shell.tsx      # App shell with auth
├── components/            # React components
│   └── auth/              # Auth components
├── lib/                   # Utilities
│   ├── auth-middleware.ts # Auth middleware
│   ├── authz-client.ts    # AuthZ service client
│   ├── data-api-client.ts # Data API client (schemas + CRUD)
│   ├── api-client.ts      # Generic API client
│   ├── sso.ts             # SSO validation (JWKS)
│   └── types.ts           # Shared types
├── .cursor/rules/         # Cursor AI rules
├── CLAUDE.md              # This file
└── env.example            # Environment template
```

### Data Storage Pattern

All data is stored via the Busibox data-api service using the `@jazzmind/busibox-app` client:

```typescript
// 1. Define document schemas in lib/data-api-client.ts
export const itemSchema: AppDataSchema = {
  fields: {
    id: { type: 'string', required: true, hidden: true },
    name: { type: 'string', required: true, label: 'Name' },
    // ...
  },
  displayName: 'Items',
  sourceApp: 'my-app',
  visibility: 'personal',
};

// 2. Ensure documents exist
const documentIds = await ensureDataDocuments(auth.apiToken);

// 3. CRUD operations
const items = await listItems(auth.apiToken, documentIds.items);
const item = await createItem(auth.apiToken, documentIds.items, input);
```

## Key Patterns

### 1. Authentication (Busibox SSO)

All apps use Busibox SSO with Zero Trust token exchange:

```typescript
// Token flow:
// 1. User clicks app in AI Portal
// 2. AI Portal exchanges session JWT for app-scoped token via authz
// 3. authz verifies user has app access via RBAC
// 4. authz issues RS256 token with app_id claim
// 5. App validates token via authz JWKS endpoint
// 6. AuthContext exchanges token via POST /api/sso to set cookies
```

**Client-side Token Exchange (AuthContext):**

The `AuthContext` component handles token exchange from URL parameters:

```typescript
// IMPORTANT: Use POST to /api/sso for token exchange
// Do NOT use GET with redirect: 'manual' - browsers don't process 
// Set-Cookie headers from redirect responses in manual mode
const response = await fetch('/api/sso', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
  credentials: 'include',
});
```

**Server-side Auth Middleware (API routes):**

```typescript
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  // auth.sessionJwt - original session JWT
  // auth.apiToken - exchanged API token for data-api calls
  // auth.isTestUser - true if using TEST_SESSION_JWT
}
```

### 2. Server vs Client Components

**Default to Server Components**:
```typescript
// app/items/page.tsx
export default async function ItemsPage() {
  const items = await fetchItems();
  return <ItemList items={items} />;
}
```

**Use Client Components for interactivity**:
```typescript
// components/ItemForm.tsx
'use client';

import { useState } from 'react';

export function ItemForm() {
  const [value, setValue] = useState('');
  // Client-side state and effects
}
```

### 3. Dynamic Route Parameters (Next.js 16)

Route params are async and must be awaited:

```typescript
// app/items/[id]/page.tsx
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ItemPage({ params }: PageProps) {
  const { id } = await params;
  const item = await fetchItem(id);

  if (!item) notFound();

  return <ItemDetail item={item} />;
}
```

### 4. API Route Params

```typescript
// app/api/items/[id]/route.ts
interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  // ...
}
```

## Environment Variables

### Required

```bash
# Application
NODE_ENV=development
PORT=3002
NEXT_PUBLIC_BASE_PATH=       # e.g., /myapp for nginx proxy
NEXT_PUBLIC_APP_URL=http://localhost:3002

# Authentication
NEXT_PUBLIC_BUSIBOX_PORTAL_URL=http://localhost:3000
AUTHZ_BASE_URL=http://localhost:8010
APP_NAME=My App              # For token audience validation
```

### Backend Services

```bash
# Data API (for structured data storage)
DATA_API_URL=http://localhost:8002
DEFAULT_API_AUDIENCE=data-api

# Backend API (for custom backend proxy)
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000

# Agent API (for AI agent interactions)
AGENT_API_URL=http://localhost:8000
```

## Development Workflow

### Adding a New Feature

1. **Plan the feature**:
   - Define data model (schemas in `lib/data-api-client.ts`)
   - Design UI components
   - Define API routes

2. **Define data model**:
   ```typescript
   // lib/data-api-client.ts
   export const mySchema: AppDataSchema = { ... };
   ```

3. **Create API routes**:
   ```typescript
   // app/api/feature/route.ts
   export async function GET(request: NextRequest) {
     const auth = await requireAuthWithTokenExchange(request, 'data-api');
     if (auth instanceof NextResponse) return auth;
     // ...
   }
   ```

4. **Create components**:
   ```typescript
   // components/feature/FeatureComponent.tsx
   export function FeatureComponent() {
     // Implementation
   }
   ```

5. **Add pages**:
   ```typescript
   // app/feature/page.tsx
   export default function FeaturePage() {
     // Implementation
   }
   ```

## Testing

### Unit Tests

```bash
npm test
```

### Writing Tests

```typescript
// app/api/items/route.test.ts
import { describe, it, expect } from 'vitest';

describe('Items API', () => {
  it('should return items for authenticated user', async () => {
    // Test implementation
  });
});
```

## Busibox Integration

### Shared Components

The `@jazzmind/busibox-app` package provides:

- **ThemeProvider**: Dark/light mode
- **BusiboxApiProvider**: API configuration
- **CustomizationProvider**: Branding
- **FetchWrapper**: Auth-aware fetch
- **Footer, VersionBar**: Standard UI elements
- **Data API Client**: `ensureDocuments`, `queryRecords`, `insertRecords`, etc.

### Deployment

Apps are deployed to the apps-lxc container via Ansible:

1. Code pushed to GitHub
2. Ansible pulls and deploys
3. PM2 manages the process
4. nginx proxies requests

### Service Discovery

```bash
# Production IPs
AI Portal: 10.96.200.201:3000
AuthZ: 10.96.200.210:8010
Data API: 10.96.200.206:8002
Apps LXC: 10.96.200.201

# Staging IPs
AI Portal: 10.96.201.201:3000
AuthZ: 10.96.201.210:8010
Data API: 10.96.201.206:8002
Apps LXC: 10.96.201.201
```

## Best Practices

### Code Style

- Use TypeScript for type safety
- Follow Next.js App Router conventions
- Use Server Components by default
- Keep components small and focused
- Use Tailwind CSS for styling

### API Routes

- Always authenticate requests with `requireAuthWithTokenExchange`
- Specify the correct audience (`data-api`, `agent-api`, etc.)
- Handle errors gracefully
- Return appropriate status codes
- Use proper TypeScript types

### Data Storage

- Define schemas in `lib/data-api-client.ts`
- Use `ensureDataDocuments()` before CRUD operations
- Use `generateId()` and `getNow()` from `@jazzmind/busibox-app`
- Handle not-found cases properly

### Security

- Never expose secrets in client code
- Validate all user input
- Use RBAC for authorization
- Log security events

## Troubleshooting

### Auth Issues

```bash
# Check AuthZ service
curl http://authz:8010/health

# Check JWKS endpoint
curl http://authz:8010/.well-known/jwks.json
```

### Data API Issues

```bash
# Check data-api health
curl http://data-api:8002/health
```

### Build Issues

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Related Projects

- **Busibox**: Infrastructure and deployment automation
- **Busibox Portal**: Main dashboard application
- **Busibox-App**: Shared component library (@jazzmind/busibox-app)
- **Busibox Agents**: Reference implementation
- **Busibox Projects**: Reference data-api implementation

## Important Notes

1. **No direct database access**: All storage goes through data-api
2. **Authentication**: All apps use Busibox SSO - no custom auth needed
3. **Deployment**: Always use Ansible for deployment to Busibox infrastructure
4. **Port**: Default port is 3002 (adjust in env if needed)
5. **Base Path**: Configure NEXT_PUBLIC_BASE_PATH for nginx proxy routing
