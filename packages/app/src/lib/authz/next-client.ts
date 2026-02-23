/**
 * AuthZ client (server-side only)
 *
 * Zero Trust Authentication Architecture:
 * - AuthZ issues RS256-signed session JWTs
 * - busibox-portal exchanges session JWTs for downstream access tokens
 * - NO client credentials required for user operations
 *
 * This module uses the shared Zero Trust functions from busibox-app.
 */

import {
  exchangeTokenZeroTrust,
  getAuthHeaderZeroTrust,
  invalidateZeroTrustToken,
  clearZeroTrustTokenCache,
  getUserIdFromSessionJwt,
  InvalidSessionError,
  isInvalidSessionError,
  type AuthzAudience as SharedAuthzAudience,
  type ZeroTrustExchangeResponse,
} from '@jazzmind/busibox-app';

// Re-export error utilities for use in middleware/routes
export { InvalidSessionError, isInvalidSessionError };

// Re-export types
export type AuthzAudience = SharedAuthzAudience;

// Verbose logging toggle
const VERBOSE_AUTHZ_LOGGING = process.env.VERBOSE_AUTHZ_LOGGING === 'true';

function authzLog(...args: unknown[]): void {
  if (VERBOSE_AUTHZ_LOGGING) {
    console.log(...args);
  }
}

import { getAuthzBaseUrl } from './authz-url';

// Re-export so existing consumers don't break
export { getAuthzBaseUrl };

/**
 * Get standard RBAC client options for authz service calls.
 * Zero Trust: Only authzUrl is needed - no admin tokens or client credentials.
 * 
 * Import this instead of duplicating getAuthzOptions() in every route file.
 */
export function getAuthzOptions(): { authzUrl: string } {
  return {
    authzUrl: getAuthzBaseUrl(),
  };
}

/**
 * Get RBAC client options with an exchanged access token for admin operations.
 * 
 * Use this for admin routes that need to access user management or RBAC APIs.
 * Exchanges the session JWT for an authz-api access token.
 * 
 * Note: The scopes in the access token come from the user's roles, not from
 * this request. The Admin role must have authz.* scopes configured.
 * 
 * @param sessionJwt - The admin user's session JWT from requireAdminAuth()
 * @returns Options object with authzUrl and accessToken for busibox-app RBAC functions
 */
export async function getAuthzOptionsWithToken(sessionJwt: string): Promise<{ authzUrl: string; accessToken: string }> {
  const result = await exchangeTokenZeroTrust(
    {
      sessionJwt,
      audience: 'authz-api',
      purpose: 'admin-operations',
    },
    {
      authzBaseUrl: getAuthzBaseUrl(),
      verbose: process.env.VERBOSE_AUTHZ_LOGGING === 'true',
    }
  );

  return {
    authzUrl: getAuthzBaseUrl(),
    accessToken: result.accessToken,
  };
}

/**
 * Exchange session JWT for a downstream access token and return just the token string.
 *
 * Thin wrapper around exchangeTokenZeroTrust for the common case where you
 * only need the access token, not the full response.
 *
 * @param sessionJwt - Session JWT from busibox-session cookie
 * @param audience - Target service (e.g., 'agent-api', 'data-api')
 * @param scopes - Optional scopes to request
 * @returns Access token string
 */
export async function getApiToken(
  sessionJwt: string,
  audience: AuthzAudience,
  scopes?: string[]
): Promise<string> {
  const result = await exchangeTokenZeroTrust(
    {
      sessionJwt,
      audience,
      scopes,
      purpose: process.env.APP_NAME || 'busibox-app',
    },
    {
      authzBaseUrl: getAuthzBaseUrl(),
      verbose: VERBOSE_AUTHZ_LOGGING,
    }
  );

  return result.accessToken;
}

// =============================================================================
// Zero Trust Token Exchange (Preferred Method)
// =============================================================================

/**
 * Exchange a session JWT for a downstream access token (Zero Trust mode).
 *
 * This is the preferred method - no client credentials required.
 * The session JWT cryptographically proves user identity.
 *
 * @param args.userId - Deprecated and ignored. User ID is extracted from the
 *   session JWT by the authz service. Kept for backward compatibility.
 */
export async function exchangeWithSubjectToken(args: {
  sessionJwt: string;
  /** @deprecated Ignored -- user ID is extracted from the session JWT. */
  userId?: string;
  audience: AuthzAudience;
  scopes?: string[];
  purpose?: string;
}): Promise<{ accessToken: string; tokenType: 'bearer'; expiresIn: number; scope: string }> {
  authzLog('[AUTHZ] Zero Trust token exchange:', {
    userId: args.userId,
    audience: args.audience,
    scopes: args.scopes,
  });

  const result = await exchangeTokenZeroTrust(
    {
      sessionJwt: args.sessionJwt,
      audience: args.audience,
      scopes: args.scopes,
      purpose: args.purpose,
    },
    {
      authzBaseUrl: getAuthzBaseUrl(),
      verbose: VERBOSE_AUTHZ_LOGGING,
    }
  );

  return {
    accessToken: result.accessToken,
    tokenType: result.tokenType,
    expiresIn: result.expiresIn,
    scope: result.scope,
  };
}

/**
 * Get authorization header using session JWT (Zero Trust mode).
 *
 * This is the preferred method - no client credentials required.
 *
 * @param args.userId - Deprecated and ignored. User ID is extracted from the
 *   session JWT by the authz service. Kept for backward compatibility.
 */
export async function getAuthorizationHeaderWithSession(args: {
  sessionJwt: string;
  /** @deprecated Ignored -- user ID is extracted from the session JWT. */
  userId?: string;
  audience: AuthzAudience;
  scopes?: string[];
  purpose?: string;
}): Promise<string> {
  return getAuthHeaderZeroTrust(
    {
      sessionJwt: args.sessionJwt,
      audience: args.audience,
      scopes: args.scopes,
      purpose: args.purpose,
    },
    {
      authzBaseUrl: getAuthzBaseUrl(),
      verbose: VERBOSE_AUTHZ_LOGGING,
    }
  );
}

/**
 * Invalidate a cached downstream token.
 */
export function invalidateDownstreamToken(
  userId: string,
  audience: AuthzAudience,
  scopes?: string[]
): void {
  invalidateZeroTrustToken(userId, audience, scopes || []);
  authzLog('[AUTHZ] Token cache invalidated for:', { userId, audience });
}

/**
 * Clear all cached tokens.
 */
export { clearZeroTrustTokenCache };

// =============================================================================
// Delegation Tokens (for background/scheduled tasks)
// =============================================================================

export {
  createDelegationToken,
  listDelegationTokens,
  revokeDelegationToken,
} from './delegation';

// =============================================================================
// Utility Re-exports
// =============================================================================

export { getUserIdFromSessionJwt };
