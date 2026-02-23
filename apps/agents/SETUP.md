# Agent Manager Setup Guide

## Quick Start (Local Development)

### 1. Configure Environment

```bash
# Copy the example file
cp env.example .env.local

# Edit .env.local - values should work as-is for production LXC containers
# Ensure AUTHZ_BASE_URL points to your authz service
```

### 3. Install and Run

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

The app will run on http://localhost:3001

### 4. Test the Flow

**Option A: Direct Testing (Recommended for Development)**

With `TEST_USER_ID` and `TEST_USER_EMAIL` configured in `.env.local`:

1. Go directly to http://localhost:3001
2. Will automatically authenticate as test user
3. No SSO flow needed
4. Agents should load immediately

**Option B: Full SSO Flow Testing**

1. Go to ai-portal: http://10.96.200.201:3000
2. Log in with your credentials
3. Click "Agent Manager" app
4. Should redirect to http://localhost:3001?token=...
5. Token exchange happens automatically
6. Agents should load

## Test User Credentials

For local development, you can bypass the SSO flow entirely by using test user credentials:

```bash
# In .env.local
TEST_USER_ID=696ca76f-5e94-43d6-a628-2e5104fc6ba9
TEST_USER_EMAIL=test@busibox.local
```

**How it works:**
1. When no SSO token is present, the middleware checks for `TEST_USER_ID`
2. If found, it directly requests an authz token for that user
3. Bypasses the entire ai-portal SSO flow
4. Perfect for rapid local development and testing

**Security:**
- Only works in development (never set in production)
- Test user must exist in authz service
- Test user should have appropriate roles/permissions

## Troubleshooting

### "AuthZ not configured"

**Problem**: Missing AuthZ configuration

**Solution**:
```bash
# Make sure .env.local exists and has:
AUTHZ_BASE_URL=http://10.96.200.210:8010
```

### "kid missing from token header"

**Problem**: Token exchange is not happening

**Solution**:
1. Check browser console for errors
2. Check terminal logs for token exchange errors
3. Verify AuthZ configuration is correct
4. Test token exchange manually:
   ```bash
   curl -X POST http://10.96.200.210:8010/oauth/token \
     -d "grant_type=urn:ietf:params:oauth:grant-type:token-exchange" \
     -d "client_id=agent-manager" \
     -d "client_secret=<your-secret>" \
     -d "requested_subject=<user-id>" \
     -d "audience=agent-api" \
     -d "scope=agents:read agents:write"
   ```

### "Token exchange failed (401)"

**Problem**: Invalid client credentials

**Solution**:
1. Verify AuthZ configuration
2. Check if agent-manager is registered with authz
3. Check authz service logs

### "Failed to load agents"

**Problem**: Can't reach agent-server or authentication failed

**Solution**:
1. Check if agent-server is running: `curl http://10.96.200.202:8000/health`
2. Check network access to LXC containers
3. Check browser console and terminal logs
4. Verify token exchange is working (see above)

### Can't reach LXC containers (10.96.200.x)

**Problem**: Network routing issue

**Solution**:
1. Verify you're on the correct network
2. Check VPN connection if remote
3. Test connectivity: `ping 10.96.200.202`
4. Check firewall rules

## Production Deployment

See `docs/AUTHENTICATION.md` for complete deployment guide.

**Key steps**:
1. Register agent-manager with authz service
2. Set environment variables in production
3. Deploy to LXC container or subdomain
4. Update ai-portal app configuration with production URL

## Architecture

```
User → AI Portal (login) → SSO Token
  ↓
Agent Manager (this app)
  ↓
AuthZ Service (token exchange)
  ↓
Agent Server (API calls)
```

See `docs/AUTHENTICATION.md` for detailed architecture documentation.

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTHZ_BASE_URL` | No | `http://10.96.200.210:8010` | AuthZ service URL |
| `NEXT_PUBLIC_BUSIBOX_PORTAL_URL` | No | `http://10.96.200.201:3000` | Busibox Portal URL for SSO |
| `NEXT_PUBLIC_AGENT_API_URL` | No | `http://10.96.200.202:8000` | Agent Server URL |
| `PORT` | No | `3001` | Local dev server port |

## Next Steps

- Read `docs/AUTHENTICATION.md` for architecture details
- Check `env.example` for all configuration options
- Review `docs/DEPLOYMENT-SUCCESS.md` for deployment guide
