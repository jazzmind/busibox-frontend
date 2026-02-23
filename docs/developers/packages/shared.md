# shared

**Package:** @busibox/shared  
**Location:** packages/shared

Shared utilities for auth middleware and API client patterns used across apps. Workspace package only; not published to npm.

## Contents

- auth-middleware.ts (requireAuthWithTokenExchange)
- authz-client.ts (token exchange, getUserIdFromSessionJwt)
- sso.ts (JWKS validation)
- api-client.ts

## Purpose

Provides consistent authentication patterns across all apps. Each app uses these utilities for:
- Server-side auth: requireAuthWithTokenExchange(request, audience)
- Token exchange: exchangeWithSubjectToken
- SSO validation via authz JWKS

## Usage

Apps that share the portal shell structure (portal, admin, chat, documents, media) typically have their own copy of these lib files or import from @busibox/shared when the package exists.
