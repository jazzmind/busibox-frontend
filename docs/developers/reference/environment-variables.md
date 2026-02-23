# Environment Variables Reference

Consolidated environment variables across all busibox-frontend apps.

## Common to All Apps

| Variable | Description |
|----------|-------------|
| NODE_ENV | `development` or `production` |
| NEXT_PUBLIC_BASE_PATH | Base path (e.g. `/admin`, `/chat`) |
| NEXT_PUBLIC_APP_URL | Full app URL |
| NEXT_PUBLIC_BUSIBOX_PORTAL_URL | Portal URL (e.g. `http://localhost:3000`) |
| AUTHZ_BASE_URL | AuthZ service URL (e.g. `http://authz-api:8010`) |

## Portal / Admin Specific

| Variable | Description |
|----------|-------------|
| BETTER_AUTH_URL | Session auth URL (not better-auth package) |
| BETTER_AUTH_SECRET | Session encryption secret |
| DATABASE_URL | PostgreSQL connection string for admin app |
| GITHUB_CLIENT_ID | GitHub OAuth client ID (deployment system) |
| GITHUB_CLIENT_SECRET | GitHub OAuth client secret |
| GITHUB_REDIRECT_URI | GitHub OAuth redirect URI |
| ENCRYPTION_KEY | Optional; defaults to BETTER_AUTH_SECRET |

## Agent / Chat / Backend Integration

| Variable | Description |
|----------|-------------|
| AGENT_API_URL | Agent server URL (alternative: AGENT_HOST + AGENT_API_PORT) |
| AGENT_HOST | Agent server host |
| AGENT_API_PORT | Agent server port |
| NEXT_PUBLIC_AGENT_API_URL | Client-side agent API URL |
| NEXT_PUBLIC_DATA_API_URL | Data API URL |
| DATA_API_URL | Data API URL for structured storage |
| DEFAULT_API_AUDIENCE | Token audience (`data-api`, `agent-api`, etc.) |

## App Template

| Variable | Description |
|----------|-------------|
| APP_NAME | Token audience validation |
| PORT | App port (default 3002) |

## Service IPs

### Production

| Service | IP:Port |
|---------|---------|
| Portal | 10.96.200.201:3000 |
| AuthZ | 10.96.200.210:8010 |
| Data API | 10.96.200.206:8002 |
| Agent | 10.96.200.202:8000 |

### Staging

| Service | IP:Port |
|---------|---------|
| Portal | 10.96.201.201:3000 |
| AuthZ | 10.96.201.210:8010 |
| Data API | 10.96.201.206:8002 |
| Agent | 10.96.201.202:8000 |
