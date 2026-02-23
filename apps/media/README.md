# AI Portal - SSO with RBAC

> Secure single sign-on portal with role-based access control for AI Portal internal tools

## 📦 Local Development with busibox-app

Developing with local busibox-app? See **[BUSIBOX_DEV.md](./BUSIBOX_DEV.md)** for instant feedback without publishing!

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Resend API key (for email)

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database
npx prisma db push

# Seed initial data
npm run db:seed

# Verify setup
npm run test:auth

# Start development server
npm run dev
```

Visit `http://localhost:3000` and log in with your admin email.

## 📋 Features

### ✅ Implemented (MVP - User Story 1)

- **Magic Link Authentication**
  - Passwordless login via email
  - 15-minute expiration
  - Email domain restrictions (`ALLOWED_EMAIL_DOMAINS`)
  - Auto-create accounts for allowed domains
  
- **Session Management**
  - 24-hour sessions
  - HTTP-only secure cookies
  - Automatic session refresh
  
- **User Dashboard**
  - Personalized app grid
  - User profile display
  - Role-based app visibility
  
- **Role-Based Access Control (RBAC)**
  - User roles and permissions
  - App-level access control
  - Admin role for system management
  
- **Audit Logging**
  - All authentication events logged
  - Security-sensitive operations tracked
  - 90-day retention (configurable)

- **Email Integration**
  - Branded magic link emails
  - Resend email delivery
  - Customizable templates

### 🚧 Coming Soon

- **User Story 2**: SSO Token Generation (OAuth server-to-server)
- **User Story 3**: Admin Panel (user, role, app management)
- **User Story 4**: Advanced features (bulk operations, analytics)

## 🗂️ Project Structure

```
busibox-portal/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   └── dashboard/     # Dashboard data endpoints
│   │   ├── login/             # Login page
│   │   ├── verify/            # Magic link verification
│   │   └── page.tsx           # Protected dashboard
│   ├── components/            # React components
│   │   ├── auth/              # Auth components
│   │   ├── dashboard/         # Dashboard components
│   │   └── shared/            # Reusable UI components
│   ├── lib/                   # Core utilities
│   │   ├── auth.ts            # Better Auth config
│   │   ├── db.ts              # Prisma client
│   │   ├── email.ts           # Email sending
│   │   ├── permissions.ts     # RBAC utilities
│   │   ├── middleware.ts      # Route protection
│   │   ├── sso.ts             # SSO token handling
│   │   ├── audit.ts           # Audit logging
│   │   └── email-validation.ts # Domain validation
│   └── types/                 # TypeScript types
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seeding
├── scripts/
│   └── test-auth.ts           # Setup verification script
├── TESTING.md                 # Comprehensive test guide
└── README.md                  # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following:

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/portal_dev"

# Better Auth
BETTER_AUTH_SECRET="<generate-32-byte-hex>"
BETTER_AUTH_URL="http://localhost:3000"

# Resend (Email)
RESEND_API_KEY="<your-resend-api-key>"
EMAIL_FROM="Portal <noreply@localhost>"

# OAuth/SSO
SSO_JWT_SECRET="<generate-32-byte-hex>"
SSO_TOKEN_EXPIRY="900"

# Admin Bootstrap
ADMIN_EMAIL="admin@localhost"

# Email Domain Restrictions (optional)
# Comma-separated list of allowed domains, or "*" for all
ALLOWED_EMAIL_DOMAINS="localhost"

# Environment
NODE_ENV="development"
```

**Generate secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database Schema

The application uses Prisma ORM with PostgreSQL. Key entities:

- **User**: User accounts with status (PENDING, ACTIVE, DEACTIVATED)
- **Role**: User roles (e.g., Admin, Finance Team)
- **App**: Applications accessible through the portal
- **Session**: Active user sessions
- **MagicLink**: Magic link tokens for authentication
- **UserRole**: Many-to-many relationship between users and roles
- **RolePermission**: Which roles can access which apps
- **OAuthToken**: SSO tokens for external apps
- **AuditLog**: Security event logging

## 🧪 Testing

### Quick Setup Check

```bash
npm run test:auth
```

This verifies:
- ✅ Database connection
- ✅ Admin user exists
- ✅ Roles configured
- ✅ Apps available
- ✅ Environment variables set
- ✅ Permissions working

### Manual Testing

See [TESTING.md](./TESTING.md) for comprehensive test scenarios including:

- Magic link flow (first-time and returning users)
- Email domain validation
- Session persistence
- Link expiration
- Deactivated accounts
- API endpoint testing
- Security testing

### Development Testing

```bash
# Start dev server
npm run dev

# In another terminal, test auth setup
npm run test:auth

# Check database
npx prisma studio
```

## 📚 API Documentation

### Authentication Endpoints

**POST `/api/auth/magic-link`**
- Request a magic link email
- Body: `{ "email": "user@example.com" }`
- Returns: Success message

**GET `/api/auth/verify-magic-link?token=...`**
- Verify magic link token
- Query: `token` - Magic link token from email
- Returns: Success and redirects to dashboard

**GET `/api/auth/session`**
- Get current user session
- Auth: Required (session cookie)
- Returns: User profile with roles

**POST `/api/auth/logout`**
- Log out current user
- Auth: Required (session cookie)
- Returns: Success message

### Dashboard Endpoints

**GET `/api/dashboard/apps`**
- Get apps user has access to
- Auth: Required
- Returns: Array of app objects

**GET `/api/dashboard/profile`**
- Get current user profile
- Auth: Required
- Returns: User profile with roles and metadata

## 🔒 Security Features

- **Passwordless Authentication**: No passwords to compromise
- **Magic Link Expiration**: 15-minute token lifetime
- **Single-Use Tokens**: Tokens can only be used once
- **Email Domain Validation**: Restrict access by email domain
- **Session Security**: HTTP-only, secure, same-site cookies
- **Audit Logging**: All security events logged
- **Role-Based Access**: Fine-grained permission control
- **JWT for SSO**: Signed tokens for external apps

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:seed      # Seed database with initial data
npm run test:auth    # Verify authentication setup
```

### Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Code linting configured
- **Tailwind CSS v4**: Utility-first styling (no @apply)
- **Next.js 15**: App Router with Server Components
- **React 19**: Latest React features

### Database Management

```bash
# Open Prisma Studio (GUI)
npx prisma studio

# View database schema
npx prisma db pull

# Reset database (⚠️ deletes all data)
npx prisma migrate reset
```

## 📖 Documentation

- [TESTING.md](./TESTING.md) - Comprehensive testing guide
- [specs/001-sso-portal-using/](./specs/001-sso-portal-using/) - Feature specifications
  - `spec.md` - Requirements and user stories
  - `plan.md` - Implementation plan
  - `tasks.md` - Task breakdown
  - `data-model.md` - Database design
  - `research.md` - Technology decisions
  - `quickstart.md` - Setup guide

## 🤝 Contributing

This is an internal AI Portal project. For questions or issues:

1. Check [TESTING.md](./TESTING.md) for troubleshooting
2. Review audit logs: `SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC`
3. Contact system administrator

## 📝 License

© 2025 AI Portal Internal Use Only.

---

**Built with**: Next.js 15 • React 19 • TypeScript • Prisma • Better Auth • Tailwind CSS v4
