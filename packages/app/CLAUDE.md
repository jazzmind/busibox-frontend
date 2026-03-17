# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor AI when working with code in this repository.

## Project Overview

**Busibox-App** (`@jazzmind/busibox-app`) is a TypeScript library package providing shared components, contexts, and service clients for the Busibox ecosystem. It's published to npm and used by busibox-portal, busibox-agents, and other Busibox applications.

## Quick Start

### Development Commands

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Watch mode for development
npm run dev

# Type check
npm run type-check

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Local Development with Consuming Apps

```bash
# In busibox-app directory
npm run build

# In consuming app (e.g., busibox-portal)
npm link ../busibox-app
```

### Publishing

```bash
npm run build
npm publish
```

## Architecture

### Package Structure

```
busibox-app/
├── src/
│   ├── components/        # 56 React components
│   │   ├── chat/         # Chat UI components
│   │   ├── documents/    # Document viewer components
│   │   ├── insights/     # Insights display components
│   │   └── ui/           # Base UI components
│   ├── contexts/         # 4 React context providers
│   │   ├── ThemeProvider.tsx
│   │   ├── CustomizationProvider.tsx
│   │   └── index.ts
│   ├── layout/           # 6 layout components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── index.ts
│   ├── lib/              # 27 utility/client modules
│   │   ├── api/          # API client utilities
│   │   ├── auth/         # Authentication helpers
│   │   ├── data/       # Data service client
│   │   ├── agent/        # Agent service client
│   │   ├── search/       # Search service clients
│   │   └── rbac/         # RBAC client
│   ├── sso/              # 2 SSO modules
│   ├── types/            # 8 TypeScript type definitions
│   └── index.ts          # Main export file
├── tests/                # Integration tests
│   ├── data.test.ts
│   ├── embeddings.test.ts
│   ├── chat-client.test.ts
│   ├── audit.test.ts
│   ├── rbac.test.ts
│   ├── search.test.ts
│   └── README.md
├── dist/                 # Compiled output
├── docs/                 # Documentation
└── package.json
```

### Build Output

The package is built with `tsup` and outputs:
- CommonJS and ESM modules
- TypeScript declarations
- Source maps

## Key Exports

### Components

```typescript
import { 
  Header, 
  Footer, 
  ThemeToggle,
  ChatInterface,
  DocumentViewer,
  InsightsPanel
} from '@jazzmind/busibox-app';
```

### Contexts

```typescript
import { 
  ThemeProvider, 
  CustomizationProvider,
  useTheme,
  useCustomization
} from '@jazzmind/busibox-app';
```

### Service Clients

```typescript
import { 
  DataClient,
  AgentClient,
  RBACClient,
  AuditClient,
  SearchClient,
  EmbeddingsClient
} from '@jazzmind/busibox-app';
```

### Types

```typescript
import type { 
  SessionData,
  NavigationItem,
  PortalCustomization,
  ChatMessage,
  Document
} from '@jazzmind/busibox-app';
```

### Document Sharing

```typescript
import {
  ensureTeamRole,
  addRoleToDocuments,
  addRoleToLibrary,
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
  searchUsers,
  setDocumentVisibility,
  resolveVisibilityMode,
  getSSOTokenFromRequest,
  type VisibilityMode,
  type TeamMember,
  type TeamRole,
} from '@jazzmind/busibox-app/lib/data/sharing';
```

## Service Clients

### DataClient
Handles file uploads, parsing, and embeddings:
```typescript
const client = new  DataClient({ baseUrl, token });
await client.uploadFile(file, options);
await client.parseMarkdown(content);
await client.getPresignedUrl(fileId);
```

### AgentClient
Communicates with the Agent API:
```typescript
const client = new AgentClient({ baseUrl, token });
await client.chat(messages, options);
await client.getAgents();
```

### RBACClient
Role-based access control:
```typescript
const client = new RBACClient({ baseUrl, token });
await client.getRoles();
await client.hasRole(userId, roleId);
await client.isAdmin(userId);
```

### AuditClient
Audit logging:
```typescript
const client = new AuditClient({ baseUrl, token });
await client.log({ action, resource, details });
```

### SearchClient
Search providers (Tavily, SerpAPI, Perplexity, Bing):
```typescript
const client = SearchClient.create('tavily', { apiKey });
await client.search(query, options);
```

## Testing

### Integration Tests

Tests require real services running. See `tests/README.md` for full setup.

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- data.test.ts
npm test -- embeddings.test.ts
npm test -- chat-client.test.ts
npm test -- rbac.test.ts
npm test -- audit.test.ts
npm test -- search.test.ts

# With coverage
npm run test:coverage
```

### Required Environment Variables

```bash
# Data Service
DATA_API_HOST=localhost
DATA_API_PORT=8002

# Agent Service
AGENT_API_URL=http://localhost:8000

# AuthZ Service
AUTHZ_BASE_URL=http://10.96.200.210:8010
AUTHZ_ADMIN_TOKEN=your-admin-token

# Search Providers (optional)
TAVILY_API_KEY=your-tavily-key
SERPAPI_API_KEY=your-serpapi-key
```

### Test Coverage Target

**80% coverage** for all service clients.

## Development Workflow

### Adding a New Component

1. **Create component file**:
   ```typescript
   // src/components/your-component/YourComponent.tsx
   export function YourComponent(props: YourComponentProps) {
     // Implementation
   }
   ```

2. **Add types**:
   ```typescript
   // src/types/your-component.ts
   export interface YourComponentProps {
     // Props definition
   }
   ```

3. **Export from index**:
   ```typescript
   // src/index.ts
   export { YourComponent } from './components/your-component';
   export type { YourComponentProps } from './types/your-component';
   ```

4. **Build and test**:
   ```bash
   npm run build
   npm test
   ```

### Adding a New Service Client

1. **Create client file**:
   ```typescript
   // src/lib/your-client.ts
   export class YourClient {
     constructor(options: ClientOptions) {
       // Setup
     }
     
     async someMethod(): Promise<Result> {
       // Implementation
     }
   }
   ```

2. **Add tests**:
   ```typescript
   // tests/your-client.test.ts
   describe('YourClient', () => {
     it('should work', async () => {
       // Test
     });
   });
   ```

3. **Export from index**:
   ```typescript
   // src/index.ts
   export { YourClient } from './lib/your-client';
   ```

### Versioning

Follow semantic versioning:
- **MAJOR**: Breaking API changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes

## Best Practices

### Code Style

- Use TypeScript strictly
- Export types alongside implementations
- Keep components pure when possible
- Use React hooks for state management

### API Clients

- Handle errors gracefully
- Add proper typing for responses
- Support both token and SSO authentication
- Include timeout handling

### Components

- Support theming via CSS variables
- Accept className for styling overrides
- Use forwardRef for DOM access
- Include proper accessibility attributes

### Testing

- Write integration tests for service clients
- Test error handling paths
- Clean up test data after tests
- Use descriptive test names

## Integration with Busibox Ecosystem

### Consuming Apps

- **busibox-portal**: Main dashboard, uses all components
- **busibox-agents**: Agent UI, uses chat components
- **Other Apps**: Can use any exported component/client

### Backend Services

Clients communicate with:
- **Data Service**: File upload, embeddings
- **Agent Service**: Chat, AI operations
- **AuthZ Service**: RBAC, audit logging
- **Search Services**: External search APIs

## Troubleshooting

### Build Issues

```bash
# Clean and rebuild
rm -rf dist
npm run build
```

### Type Errors

```bash
# Check types
npm run type-check
```

### Test Failures

```bash
# Check service availability
curl http://localhost:8002/health  # Data
curl http://localhost:8000/health  # Agent

# Run with verbose output
npm test -- --verbose
```

## Documentation

- **README.md**: Package usage and API
- **docs/**: Additional documentation
- **tests/README.md**: Testing guide

## Related Projects

- **busibox-portal**: Main consumer of this library
- **busibox-agents**: Uses chat components
- **Busibox**: Infrastructure (provides backend services)

## Important Notes

1. **Published Package**: Changes affect all consuming applications
2. **Backward Compatibility**: Maintain API compatibility in minor versions
3. **Integration Tests**: Tests require running services
4. **Build Before Publish**: Always run `npm run build` before publishing
5. **Version Bumps**: Update version in package.json before publishing
