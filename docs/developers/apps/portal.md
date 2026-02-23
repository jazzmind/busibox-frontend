# Portal

**Package:** @busibox/portal  
**Port:** 3000  
**Base path:** /portal

## Purpose

The shell app providing the core Busibox experience: authentication, home dashboard, documentation viewer, account settings, and setup wizard. Portal is the entry point for users and hosts the shared layout structure used by admin, chat, documents, and media apps.

## Routes

- `/(authenticated)/` - Authenticated layout with subroutes
- `/login` - Login page (magic link, TOTP, passkey)
- `/logout` - Logout
- `/verify` - Session verification
- `/home` - Home dashboard
- `/setup` - Setup wizard
- `/about` - About page
- `/docs` - Documentation viewer
- `/api/auth/*` - Authentication endpoints
- `/api/admin/*` - Admin API routes

## Structure

Shares structure with admin, chat, documents, and media apps. These apps were extracted from the monolithic portal and share the same layout, auth flow, and routing patterns.

## Tech Stack

- Next.js 16
- React 19
- TypeScript 5
- Tailwind CSS 4
- Prisma (database access)

## Key Dependencies

- @jazzmind/busibox-app
- @busibox/shared

## Database Access

Has direct database access via Prisma for:
- User management
- App configuration
- Deployment configuration
