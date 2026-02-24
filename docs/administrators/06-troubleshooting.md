---
title: "Troubleshooting"
category: "administrator"
order: 6
description: "Common issues and resolution steps"
published: true
---

# Troubleshooting

## Auth Scopes

If token exchange fails:

- Verify `AUTHZ_BASE_URL` is correct and reachable
- Confirm the user is authenticated (session valid)
- Check that agent-api and data-api are accessible from the app

## Failed to Initialize Chat

This error indicates auth token exchange failed.

- Check the `/api/auth/token-exchange` endpoint
- Verify the user is authenticated
- Confirm agent-api is running and reachable

## Could Not Connect to Agent-API

- Verify `AGENT_API_URL` or `AGENT_HOST` environment variable
- Test connectivity: `curl <agent-api-url>/health`
- Check network and firewall rules between app and agent-api

## Streaming Not Working

- Confirm browser supports Server-Sent Events (SSE)
- Verify the streaming endpoint returns correct Content-Type
- Inspect the Network tab for failed or blocked requests

## Build Issues

Clear cache and reinstall:

```bash
rm -rf .next
rm -rf node_modules
pnpm install
```

Then run `pnpm build` again.

## Auth Cookie Issues

- Inspect the `busibox-session` cookie in DevTools
- Verify `BETTER_AUTH_URL` matches the app URL (including protocol and port)
- Ensure cookies are not blocked by browser or extensions

## Module Not Found for busibox-app

- Check link status: `npm run link:busibox`
- Verify `packages/app` exists in the monorepo
- In standalone apps, ensure `npm run link:local` was run if using local busibox-app
