# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor AI when working with code in this repository.

## Project Overview

**AI Portal** is a Next.js application that provides a unified interface for managing AI-powered applications, document ingestion, and deployment management. It's part of the Busibox ecosystem and runs on the `apps-lxc` container.

## Quick Start

### Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database operations
npm run db:push          # Push schema changes (development)
npm run db:generate      # Generate Prisma client
npm run db:studio        # Open Prisma Studio

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode
```

### Deployment

**From Busibox Admin Workstation**:
```bash
cd /path/to/busibox/provision/ansible

# Deploy to production:
make deploy-busibox-portal

# Deploy to test environment:
make deploy-busibox-portal INV=inventory/test

# Deploy all apps:
make deploy-apps
```

**Manual Deployment** (on apps-lxc container):
```bash
cd /srv/apps/busibox-portal
git pull origin main
npm install
npm run build
pm2 restart busibox-portal
```

### Local Development

See `docs/LOCAL_DEPLOYMENT_SUPPORT.md` for detailed local development setup.

```bash
# Quick setup:
cp .env.example .env.local
# Edit .env.local with your settings
npm install
npm run db:push
npm run dev
```

## Key Features

### 1. Deployment Management System

**Location**: `src/app/admin/apps/[id]/` and `src/components/admin/DeploymentManager.tsx`

**Features**:
- GitHub OAuth integration for private repositories
- Release management and deployment triggers
- Rollback support
- Secrets management with encryption
- Staging environment support

**Documentation**: `docs/DEPLOYMENT_SYSTEM.md`

**Key APIs**:
- `/api/admin/github/*` - GitHub OAuth and connection
- `/api/admin/deployments/*` - Deployment management
- `/api/admin/deployments/secrets/*` - Secret management

### 2. Ingestion Settings

**Location**: `src/app/admin/ingestion/` and `src/components/admin/IngestionSettings.tsx`

**Features**:
- Configure document processing strategies
- Manage extraction methods (Simple, Marker, ColPali)
- Control LLM cleanup settings
- Configure chunking parameters

**Documentation**: `docs/INGESTION_SETTINGS_IMPLEMENTATION.md`

**Key APIs**:
- `/api/admin/ingestion/settings` - Get/update settings
- `/api/admin/ingestion/test` - Test extraction

### 3. Log Viewing

**Location**: `src/components/admin/LogViewer.tsx`

**Features**:
- View application logs in real-time
- Filter by log level and time range
- Search logs
- Download logs

**Documentation**: `docs/LOG_VIEWING.md`

**Key APIs**:
- `/api/admin/logs/[appId]` - Fetch logs for an app

### 4. Application Library

**Location**: `src/config/app-library.ts` and `src/app/home/`

**Features**:
- Centralized app configuration
- App cards with metadata
- Role-based access control
- Dynamic app routing

**Documentation**: `docs/APP_IMPROVEMENTS.md`

### 5. Authentication

**Location**: `src/lib/auth.ts` and `src/components/auth/`

**Features**:
- Magic link authentication
- GitHub OAuth (for deployments)
- Role-based authorization (Admin, User, Guest)
- Session management with better-auth

**Documentation**: `docs/Auth/`

## Architecture

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: better-auth
- **UI**: Tailwind CSS, shadcn/ui components
- **State Management**: React Context + Server Actions
- **Deployment**: PM2 on apps-lxc container

### Project Structure

```
busibox-portal/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── admin/             # Admin interface
│   │   ├── home/              # Main dashboard
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── admin/            # Admin components
│   │   ├── auth/             # Auth components
│   │   └── ui/               # Shared UI components
│   ├── config/               # Configuration
│   │   └── app-library.ts    # App definitions
│   ├── lib/                  # Utilities
│   │   ├── auth.ts          # Auth configuration
│   │   ├── db.ts            # Database client
│   │   └── api-url.ts       # API URL helpers
│   └── types/               # TypeScript types
├── prisma/
│   └── schema.prisma        # Database schema
├── docs/                    # Documentation
└── public/                  # Static assets
```

### Database Schema

Key models:
- `User` - User accounts and authentication
- `App` - Application definitions
- `GitHubConnection` - GitHub OAuth tokens
- `AppDeploymentConfig` - Deployment configurations
- `Deployment` - Deployment history
- `AppSecret` - Encrypted environment variables
- `GitHubRelease` - Cached release information
- `IngestionSettings` - Document processing configuration

### Environment Variables

**Required**:
```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Auth
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="https://your-domain.com"

# GitHub OAuth (for deployments)
GITHUB_CLIENT_ID="your-client-id"
GITHUB_CLIENT_SECRET="your-client-secret"
GITHUB_REDIRECT_URI="https://your-domain.com/api/admin/github/callback"
```

**Optional**:
```bash
# Encryption (defaults to BETTER_AUTH_SECRET)
ENCRYPTION_KEY="your-encryption-key"

# API URLs (for local dev)
NEXT_PUBLIC_AGENT_API_URL="http://localhost:8000"
NEXT_PUBLIC_DATA_API_URL="http://localhost:8001"
```

See `docs/reference/busibox-portal-environment-variables.md` for complete list.

## Development Workflow

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes and test locally**:
   ```bash
   npm run dev
   # Test in browser at http://localhost:3000
   ```

3. **Update database schema** (if needed):
   ```bash
   npm run db:push
   ```

4. **Commit and push**:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature
   ```

5. **Deploy to test environment**:
   ```bash
   # From busibox/provision/ansible
   make deploy-busibox-portal INV=inventory/test
   ```

6. **Verify on test**:
   ```bash
   # Check logs
   ssh root@<test-apps-ip>
   pm2 logs busibox-portal
   
   # Or use log viewer in Busibox Portal admin
   ```

7. **Merge and deploy to production**:
   ```bash
   git checkout main
   git merge feature/your-feature
   git push origin main
   
   # Deploy
   make deploy-busibox-portal
   ```

### Adding a New Feature

1. **Plan the feature**:
   - Determine if it needs database changes
   - Identify required API routes
   - Design UI components

2. **Update database schema** (if needed):
   ```prisma
   // prisma/schema.prisma
   model NewFeature {
     id        String   @id @default(cuid())
     // ... fields
   }
   ```
   ```bash
   npm run db:push
   ```

3. **Create API routes**:
   ```typescript
   // src/app/api/your-feature/route.ts
   export async function GET(request: Request) {
     // Implementation
   }
   ```

4. **Create components**:
   ```typescript
   // src/components/your-feature/YourComponent.tsx
   export function YourComponent() {
     // Implementation
   }
   ```

5. **Add to app library** (if it's a new app):
   ```typescript
   // src/config/app-library.ts
   {
     id: 'your-app',
     name: 'Your App',
     // ... configuration
   }
   ```

6. **Document the feature**:
   ```bash
   # Create docs/YOUR_FEATURE.md
   ```

### Troubleshooting

**Database Connection Issues**:
```bash
# Check PostgreSQL is running
ssh root@<pg-ip>
systemctl status postgresql

# Test connection
psql -h <pg-ip> -U busibox_user -d busibox
```

**Build Failures**:
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma client
npm run db:generate
```

**PM2 Issues**:
```bash
# On apps-lxc container
pm2 list                    # Check status
pm2 logs busibox-portal         # View logs
pm2 restart busibox-portal      # Restart app
pm2 delete busibox-portal       # Remove from PM2
pm2 start ecosystem.config.js  # Re-add
```

## Integration with Busibox

AI Portal is deployed and managed through the Busibox infrastructure:

### Deployment Flow

1. **Code Changes**: Pushed to GitHub
2. **Busibox Ansible**: Pulls changes and deploys
3. **Apps Container**: Runs the application with PM2
4. **Proxy Container**: Routes traffic via nginx

### Service Dependencies

- **PostgreSQL** (pg-lxc): Database
- **Agent API** (agent-lxc): AI operations
- **Data API** (data-lxc): Document processing
- **Milvus** (milvus-lxc): Vector search

### Configuration Management

- **Ansible Vault**: Stores secrets
- **Group Vars**: Environment-specific config
- **App Deployer Role**: Handles deployment

See Busibox documentation for infrastructure details.

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
# Requires services running
npm run test:integration
```

### Manual Testing

1. **Authentication Flow**:
   - Test magic link login
   - Test GitHub OAuth
   - Test role-based access

2. **Deployment Management**:
   - Connect GitHub account
   - Sync releases
   - Deploy to staging
   - Deploy to production
   - Test rollback

3. **Ingestion Settings**:
   - Update extraction strategy
   - Test with sample document
   - Verify settings persist

4. **Log Viewing**:
   - View logs for different apps
   - Test filtering and search
   - Verify real-time updates

## Best Practices

### Code Style

- Use TypeScript for type safety
- Follow Next.js App Router conventions
- Use Server Components by default, Client Components when needed
- Keep components small and focused
- Use Tailwind CSS for styling

### Database

- Always use Prisma for database access
- Use transactions for multi-step operations
- Add indexes for frequently queried fields
- Use `db:push` for development, migrations for production

### Security

- Never commit secrets to git
- Use environment variables for configuration
- Validate all user input
- Use parameterized queries (Prisma does this)
- Encrypt sensitive data (use encryption utilities)

### Performance

- Use Server Components for static content
- Implement loading states
- Optimize images with Next.js Image
- Use React.memo for expensive components
- Implement pagination for large lists

## Documentation

- **Deployment**: `docs/DEPLOYMENT_SYSTEM.md`
- **Ingestion**: `docs/INGESTION_SETTINGS_IMPLEMENTATION.md`
- **Logs**: `docs/LOG_VIEWING.md`
- **Auth**: `docs/Auth/`
- **Local Dev**: `docs/LOCAL_DEPLOYMENT_SUPPORT.md`
- **Improvements**: `docs/APP_IMPROVEMENTS.md`

## Support

For issues or questions:

1. Check documentation in `docs/`
2. Review Busibox documentation for infrastructure
3. Check logs: `pm2 logs busibox-portal` or use Log Viewer
4. Verify environment variables
5. Test database connection

## Related Projects

- **Busibox**: Infrastructure and deployment (`/Users/wsonnenreich/Code/busibox`)
- **Agent Server**: AI agent operations (busibox/srv/agent)
- **Busibox Agents**: Agent management UI (`/Users/wsonnenreich/Code/busibox-agents`)

## Important Notes

1. **Database Changes**: Always test schema changes locally before deploying
2. **Secrets**: Use Ansible vault for production secrets
3. **Deployment**: Always deploy to test environment first
4. **PM2**: Application runs under PM2 on apps-lxc container
5. **Routing**: Busibox Portal uses `/home` as main dashboard route

