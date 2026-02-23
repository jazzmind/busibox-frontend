# Deployment System Architecture

## Overview

The deployment management system enables administrators to deploy applications from GitHub repositories to the Busibox infrastructure. It integrates with GitHub OAuth for private repository access, manages release metadata, triggers deployments via the deploy-api service, and supports rollback and secrets management.

## GitHub Integration

- **OAuth for private repos**: Users connect a GitHub account via OAuth to access private repositories. The flow uses GitHub's OAuth App with redirect to `/api/admin/github/callback`.
- **Token storage**: Access tokens are stored encrypted. The deploy-api uses AES-256-GCM encryption with PBKDF2 key derivation for token storage.
- **Minimum scopes**: OAuth requests use the minimum required scopes (e.g., `repo` for private repo access). Token expiry is tracked and users are prompted to reconnect when tokens expire.

## Release Management

- **Sync releases**: Releases are synced from GitHub via the deploy-api. The admin UI fetches release metadata including version tags, release notes, and publish dates.
- **View notes and metadata**: Each release displays notes, changelog, and associated assets.
- **Deployed version tracking**: The system tracks which release version is currently deployed per app and environment (production/staging).

## Deployment Control

- **Manual triggers**: Deployments are triggered manually with a confirmation step before execution.
- **Production and staging**: Each app can target production or staging. Staging deployments use a separate path (e.g., `/apppath-stage/`).
- **Real-time status**: Deployment status is polled or streamed via the deploy-api. The UI shows pending, running, completed, or failed states.
- **Deployment history**: Past deployments are stored with timestamps, version, status, and logs for audit and troubleshooting.

## Rollback

- **One-click rollback**: Administrators can rollback to the previously deployed version. The system identifies the last successful deployment and redeploys it.
- **Automatic backup**: Before deploying a new version, the current deployment state is recorded to support rollback.

## Secrets Management

- **Encrypted env vars per app**: Environment variables are stored per app and are encrypted at rest.
- **AES-256-GCM with PBKDF2**: Encryption uses AES-256-GCM. Keys are derived via PBKDF2 from a master secret. Secrets are never stored in plaintext.

## Staging Environments

- **Optional per app**: Staging can be enabled per app. When enabled, the app is deployed to a staging path (e.g., `/myapp-stage/`).
- **Test before promote**: Users can validate changes on staging before promoting to production.

## Database Models

The deploy-api and portal store deployment-related data. Key models include:

| Model | Purpose |
|-------|---------|
| GitHubConnection | OAuth tokens, user association, scopes, expiry |
| AppDeploymentConfig | App ID, GitHub repo, default path/port, build/start commands, staging config |
| Deployment | Deployment ID, app ID, version, status, started/completed timestamps, logs |
| AppSecret | App ID, key, encrypted value |
| GitHubRelease | Cached release metadata (tag, name, notes, published_at) |

## API Structure

### GitHub Routes

| Route | Method | Purpose |
|-------|--------|---------|
| /api/admin/github/connect | GET | Initiate OAuth flow, returns auth URL |
| /api/admin/github/callback | POST | Handle OAuth callback, exchange code for token |
| /api/admin/github/status | GET | Check connection status, username, expiry |
| /api/admin/github/disconnect | DELETE | Remove GitHub connection |
| /api/admin/github/reconnect | POST | Refresh expired token |

### Deployment Routes

| Route | Method | Purpose |
|-------|--------|---------|
| /api/admin/deployments/config | GET/POST | List or create deployment configs |
| /api/admin/deployments/config/[configId] | GET/PUT/DELETE | Config CRUD |
| /api/admin/deployments/config/helpers | GET | Next port, path validation |
| /api/admin/deployments/releases/[configId] | GET | List releases for a config |
| /api/admin/deployments/releases/[configId]/sync | POST | Sync releases from GitHub |
| /api/admin/apps/[appId]/deploy | POST | Trigger deployment |
| /api/admin/apps/[appId]/deploy/[deploymentId]/status | GET | Deployment status |
| /api/admin/apps/[appId]/deploy/[deploymentId]/stream | GET | Stream deployment logs |
| /api/admin/deployments/rollback | POST | Rollback to previous version |
| /api/admin/deployments/secrets | GET/POST | List or create secrets |
| /api/admin/deployments/secrets/[secretId] | GET/PUT/DELETE | Secret CRUD |
| /api/admin/deployments/[deploymentId]/status | GET | Deployment status (proxy) |
| /api/admin/deployments/[deploymentId]/logs | GET | Deployment logs (proxy) |

Admin API routes proxy to the deploy-api service. The deploy-api performs the actual GitHub OAuth, release sync, deployment orchestration, and Ansible execution.

## UI Components

- **DeploymentManager**: Embedded in app detail pages (e.g., `/admin/apps/[id]`). Shows connection status, release selector, deploy/rollback buttons, deployment history, and secrets editor.
- **AppForm**: Used when creating or editing apps. Includes deployment config fields (GitHub URL, path, port, build/start commands) and path validation via `/api/admin/deployments/config/helpers`.

## Security

- **Admin-only access**: All deployment and GitHub routes enforce admin role. Non-admin users receive 403.
- **Audit logging**: Deployment triggers, rollbacks, and secret changes are logged for audit.
- **OAuth minimum scopes**: Only required GitHub scopes are requested.
- **Token expiry tracking**: Expired tokens are detected; users must reconnect before deploying from private repos.

## Routing

- **Portal dashboard**: The portal uses `/home` as the main dashboard. Root `/` redirects to `/home`.
- **App paths**: nginx routes apps to separate paths (e.g., `/agents`, `/chat`, `/documents`). Each app has a base path and port.

## Deployment via Ansible

The deploy-api orchestrates deployment by:

1. Cloning or pulling the repository from GitHub
2. Running `npm install` (or equivalent)
3. Running `npm run build` (or configured build command)
4. Restarting the app process via PM2

Ansible playbooks or scripts are invoked by the deploy-api to perform these steps on the target container (apps-lxc).
