# Admin

**Package:** @busibox/admin  
**Port:** 3002  
**Base path:** /admin

## Purpose

System administration dashboard for managing users, roles, apps, deployments, settings, and system status. Provides centralized control over the Busibox platform.

## Routes

Uses the same shell structure as portal (`/(authenticated)/`, `/login`, etc.) plus admin-specific pages:
- User management
- Role management
- App management
- Deployment management
- Settings (AI models, bridge, customization, data, email, ingestion)
- System status
- Logging
- Test runner

## Database Access

Has direct database access via Prisma for admin operations.

## Key Components

- AdminSidebar
- UserForm
- TestRunner
- TestSuiteCard
- LiveDashboard
- AIModelsSettings
- BridgeSettingsForm
- CustomizationForm
- DataSettingsForm
- EmailSettingsForm
- IngestionSettingsForm

## Tech Stack

- Next.js 16
- Prisma
- Tailwind CSS 4
