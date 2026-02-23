# Busibox App Builder

A Next.js 16 application for building Busibox apps via conversational AI workflows. This repository is scaffolded from `busibox-template` and customized for the `/builder` route and port `3004`.

## Features

- **Next.js 16** with App Router and Turbopack
- **React 19** with Server and Client Components
- **TypeScript 5** for type safety
- **Tailwind CSS 4** for styling
- **Busibox SSO** authentication via authz service
- **Data API** storage via @jazzmind/busibox-app client
- **AI-Optimized**: Comprehensive cursor rules and CLAUDE.md for AI-assisted development
- **Production Ready**: Standalone output for container deployment

## Quick Start

### 1. Clone and Install

```bash
# Copy template to new project
cp -r busibox-template my-new-app
cd my-new-app

# Update package.json name
npm pkg set name="my-new-app"

# Install dependencies
npm install
```

### 2. Configure Environment

```bash
# Copy environment template
cp env.example .env.local

# Edit with your settings
nano .env.local
```

Key settings to update:
- `APP_NAME` - Your app name
- `NEXT_PUBLIC_BUSIBOX_PORTAL_URL` - Busibox Portal URL
- `AUTHZ_BASE_URL` - AuthZ service URL
- `DATA_API_URL` - Data API service URL

### 3. Start Development

```bash
npm run dev
```

Visit http://localhost:3004

## Demo Features (Delete Before Production)

**This template includes working demo features for testing deployment.**

### What's Included

The demo features test three critical aspects of your Busibox deployment:

1. **SSO Authentication** - Validates user sessions from AI Portal
2. **Data API CRUD** - Tests data-api operations with notes
3. **Agent API Calls** - Verifies Zero Trust token exchange

### Try the Demo

Visit `/demo` after starting the development server to test:

- View authenticated user information
- Create, read, update, and delete notes via data-api
- Make downstream calls to agent-api with proper authentication

### Removing Demo Features

**Before deploying to production, delete all demo features using the checklist in `DEMO.md`.**

Quick deletion:

```bash
# Delete demo files
rm -rf app/demo/ app/api/demo/ DEMO.md

# Update navigation and home page
# Remove sections marked with "DEMO" comments
```

See [`DEMO.md`](DEMO.md) for the complete step-by-step deletion guide.

## Architecture

### Data Storage

All apps use the Busibox data-api for storage. No direct database access is needed.

```typescript
// lib/data-api-client.ts - Define your data model
import { ensureDocuments, queryRecords, insertRecords } from '@jazzmind/busibox-app';

// API routes use token exchange for auth
const auth = await requireAuthWithTokenExchange(request, 'data-api');
const documentIds = await ensureDataDocuments(auth.apiToken);
const items = await listItems(auth.apiToken, documentIds.items);
```

## Project Structure

```
my-app/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Tailwind CSS
├── components/            # React components
├── lib/                   # Utilities
│   ├── auth-middleware.ts # Auth middleware
│   ├── authz-client.ts    # AuthZ client
│   ├── data-api-client.ts # Data API client
│   ├── api-client.ts      # Generic API client
│   ├── sso.ts             # SSO validation
│   └── types.ts           # Shared types
├── .cursor/rules/         # Cursor AI rules
├── CLAUDE.md              # Claude Code guidance
└── env.example            # Environment template
```

## Customization

### 1. Update Branding

Edit `app/providers.tsx`:

```typescript
const defaultCustomization: PortalCustomization = {
  companyName: "Your Company",
  siteName: "Your App",
  slogan: "Your tagline",
  primaryColor: "#0f172a",
  // ...
};
```

### 2. Update Metadata

Edit `app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  title: "Your App",
  description: "Your app description",
};
```

### 3. Add Navigation

Edit `app/app-shell.tsx` to add your navigation links.

### 4. Define Your Data Model

Edit `lib/data-api-client.ts` to define your app's data schemas and CRUD functions.

### 5. Add Routes

Create new routes in `app/` directory:

```typescript
// app/dashboard/page.tsx
export default function DashboardPage() {
  return <div>Dashboard</div>;
}
```

## Authentication

All apps use Busibox SSO via the authz service.

### API Route Authentication

```typescript
// app/api/items/route.ts
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  const documentIds = await ensureDataDocuments(auth.apiToken);
  const items = await listItems(auth.apiToken, documentIds.items);
  return NextResponse.json(items);
}
```

### Session Check

```typescript
// components/ProtectedComponent.tsx
'use client';

import { useAuth } from '@jazzmind/busibox-app';

export function ProtectedComponent() {
  const { authState } = useAuth();
  
  if (!authState?.isAuthenticated) {
    return <div>Please log in</div>;
  }
  
  return <div>Welcome, {authState.user?.email}</div>;
}
```

## Development

### Commands

```bash
npm run dev           # Start dev server
npm run build         # Build for production
npm run start         # Start production server
npm test              # Run tests
npm run test:watch    # Test watch mode
npm run test:coverage # Test with coverage
npm run lint          # Lint code
```

### Busibox App Package

```bash
npm run update:busibox-app  # Update to latest version
npm run link:busibox        # Link local busibox-app
npm run unlink:busibox      # Unlink and restore npm version
```

## Deployment

### Busibox Infrastructure

Deploy via Ansible:

```bash
cd /path/to/busibox/provision/ansible

# Production
make install SERVICE=my-app

# Staging
make install SERVICE=my-app INV=inventory/staging
```

### Standalone Build

The app builds with `output: 'standalone'` for container deployment:

```bash
npm run build
node .next/standalone/server.js
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
  it('should return items', async () => {
    // Test implementation
  });
});
```

## AI-Assisted Development

This template is optimized for AI-assisted development:

- **CLAUDE.md** - Comprehensive guidance for Claude Code
- **.cursor/rules/** - Cursor rules for consistent patterns
- **Typed APIs** - Full TypeScript for better AI understanding

### Key Rules

- `001-architect.mdc` - Planning and architecture
- `002-nextjs-patterns.mdc` - Next.js 16 patterns
- `003-component-org.mdc` - Component organization
- `004-database.mdc` - Data API storage patterns
- `005-api-routes.mdc` - API route patterns
- `006-authentication.mdc` - Busibox SSO

## Troubleshooting

### Auth Issues

```bash
# Check AuthZ service
curl http://localhost:8010/health

# Check JWKS endpoint
curl http://localhost:8010/.well-known/jwks.json
```

### Build Issues

```bash
# Clear cache and reinstall
rm -rf .next node_modules package-lock.json
npm install
```

### Data API Issues

```bash
# Check data-api health
curl http://localhost:8002/health
```

## Related Projects

- **Busibox** - Infrastructure and deployment
- **Busibox Portal** - Main dashboard application
- **Busibox Agents** - Reference frontend-only implementation
- **@jazzmind/busibox-app** - Shared component library

## License

Private - Jazzmind Inc.
