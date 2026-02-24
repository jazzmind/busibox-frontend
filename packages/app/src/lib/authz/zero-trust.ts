/**
 * Zero Trust Token Exchange for Server-Side Applications
 *
 * This module provides server-side token exchange using the Zero Trust pattern:
 * - Uses session JWT as subject_token (cryptographic proof of user identity)
 * - NO client credentials required for user operations
 * - Follows RFC 8693 token exchange grant type
 *
 * Architecture:
 * 1. User authenticates with authz service, receives session JWT
 * 2. Frontend apps (portal, busibox-agents) call this to exchange for downstream tokens
 * 3. No client secrets needed - the session JWT proves user identity
 *
 * Usage:
 * ```typescript
 * import { exchangeTokenZeroTrust, createZeroTrustClient } from '@jazzmind/busibox-app/lib/authz';
 *
 * // Direct function call
 * const token = await exchangeTokenZeroTrust({
 *   sessionJwt: 'eyJ...',
 *   audience: 'agent-api',
 *   scopes: ['agents:read'],
 * });
 *
 * // Or create a client instance
 * const authzClient = createZeroTrustClient({
 *   authzBaseUrl: 'http://authz-api:8010',
 * });
 * const token = await authzClient.exchangeToken({ sessionJwt, audience: 'agent-api' });
 * ```
 */

// OAuth2 constants
const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
const SUBJECT_TOKEN_TYPE_JWT = 'urn:ietf:params:oauth:token-type:jwt';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when token exchange fails due to an invalid or expired session.
 * This indicates the user should be logged out and redirected to login.
 */
export class InvalidSessionError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly shouldLogout: boolean;

  constructor(message: string, code: string, status: number = 401) {
    super(message);
    this.name = 'InvalidSessionError';
    this.code = code;
    this.status = status;
    // These error codes indicate the session is permanently invalid
    this.shouldLogout = [
      'invalid_subject_token_key',  // Signing key changed (server restart with new keys)
      'subject_token_expired',       // Token expired
      'invalid_subject_token',       // Token is malformed or invalid
      'subject_token_revoked',       // Token was revoked
      'session_revoked',             // Session revoked server-side
    ].includes(code);
  }
}

/**
 * Check if an error indicates the user should be logged out.
 */
export function isInvalidSessionError(error: unknown): error is InvalidSessionError {
  return error instanceof InvalidSessionError && error.shouldLogout;
}

// =============================================================================
// Types
// =============================================================================

export type AuthzAudience = 'data-api' | 'search-api' | 'agent-api' | (string & {});

export interface ZeroTrustExchangeRequest {
  /** The user's session JWT from authz (proves user identity) */
  sessionJwt: string;
  /** Target service audience (e.g., 'agent-api', 'data-api') */
  audience: AuthzAudience;
  /** OAuth2 scopes to request (optional) */
  scopes?: string[];
  /** Purpose label for audit (optional) */
  purpose?: string;
  /**
   * App resource ID (UUID) for app-scoped tokens.
   * When provided, authz verifies user has access to this app via RBAC bindings.
   * The issued token will include app_id claim and only roles that grant app access.
   */
  resourceId?: string;
}

export interface ZeroTrustExchangeResponse {
  accessToken: string;
  tokenType: 'bearer';
  expiresIn: number;
  scope: string;
  /** When the token expires (timestamp in ms) */
  expiresAt: number;
}

export interface ZeroTrustClientConfig {
  /** AuthZ service base URL (e.g., 'http://authz-api:8010') */
  authzBaseUrl?: string;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
  /** Token expiry buffer in seconds (default: 60) */
  expiryBufferSeconds?: number;
}

export interface ZeroTrustClient {
  /** Exchange session JWT for downstream access token */
  exchangeToken(request: ZeroTrustExchangeRequest): Promise<ZeroTrustExchangeResponse>;
  /** Get authorization header (Bearer token) */
  getAuthHeader(request: ZeroTrustExchangeRequest): Promise<string>;
  /** Clear cached token for audience/scopes */
  invalidateToken(audience: string, scopes?: string[]): void;
  /** Clear all cached tokens */
  invalidateAllTokens(): void;
}

// =============================================================================
// Token Cache
// =============================================================================

interface CachedToken {
  accessToken: string;
  tokenType: 'bearer';
  expiresAt: number;
  scope: string;
  audience: string;
}

// Global token cache keyed by "userId:audience:scopes"
const tokenCache = new Map<string, CachedToken>();

// Default expiry buffer (refresh 60 seconds before expiry)
const DEFAULT_EXPIRY_BUFFER_MS = 60 * 1000;

function getCacheKey(userId: string, audience: string, scopes: string[]): string {
  const sortedScopes = [...scopes].sort().join(',');
  return `${userId}:${audience}:${sortedScopes}`;
}

function getCachedToken(
  userId: string,
  audience: string,
  scopes: string[],
  bufferMs: number = DEFAULT_EXPIRY_BUFFER_MS
): CachedToken | null {
  const key = getCacheKey(userId, audience, scopes);
  const cached = tokenCache.get(key);

  if (!cached) return null;

  // Check if token is still valid (with buffer)
  if (Date.now() >= cached.expiresAt - bufferMs) {
    tokenCache.delete(key);
    return null;
  }

  return cached;
}

function setCachedToken(userId: string, token: CachedToken): void {
  const scopes = token.scope.split(' ').filter(Boolean);
  const key = getCacheKey(userId, token.audience, scopes);
  tokenCache.set(key, token);
}

function invalidateCachedToken(userId: string, audience: string, scopes: string[]): void {
  const key = getCacheKey(userId, audience, scopes);
  tokenCache.delete(key);
}

function invalidateAllCachedTokens(): void {
  tokenCache.clear();
}

// =============================================================================
// JWT Parsing (simple, no verification - verification is done by authz)
//
// Server-only (uses Buffer). For isomorphic JWT parsing that also works in
// browsers, see parseJWTPayload / getUserIdFromToken in auth-helper.ts.
// =============================================================================

interface JwtClaims {
  sub: string;
  exp: number;
  iat?: number;
  typ?: string;
  [key: string]: unknown;
}

function parseJwtClaims(token: string): JwtClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(decoded) as JwtClaims;
  } catch {
    return null;
  }
}

function isJwtFormat(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

// =============================================================================
// Environment Configuration
// =============================================================================

function getAuthzBaseUrl(configUrl?: string): string {
  if (configUrl) return configUrl;
  return process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';
}

// =============================================================================
// Zero Trust Token Exchange
// =============================================================================

/**
 * Exchange a session JWT for a downstream access token (Zero Trust mode).
 *
 * This is the core function that implements RFC 8693 token exchange:
 * - Uses subject_token (the session JWT) to prove user identity
 * - NO client credentials required
 * - The session JWT cryptographically proves who the user is
 *
 * @param request - Token exchange request
 * @param config - Optional configuration overrides
 * @returns Token exchange response with access token
 */
export async function exchangeTokenZeroTrust(
  request: ZeroTrustExchangeRequest,
  config?: ZeroTrustClientConfig
): Promise<ZeroTrustExchangeResponse> {
  const { sessionJwt, audience, scopes = [], purpose, resourceId } = request;
  const { authzBaseUrl, verbose = false, expiryBufferSeconds = 60 } = config || {};

  // Validate session JWT format
  if (!isJwtFormat(sessionJwt)) {
    throw new Error('Invalid session token format: expected JWT');
  }

  // Parse claims to get user ID for caching
  const claims = parseJwtClaims(sessionJwt);
  if (!claims || !claims.sub) {
    throw new Error('Invalid session token: missing subject claim');
  }

  // Check if token is expired
  if (claims.exp * 1000 < Date.now()) {
    throw new Error('Session token has expired');
  }

  const userId = claims.sub;
  const scopeArray = scopes.filter(Boolean);
  const scopeString = scopeArray.join(' ');

  // For app-scoped tokens, include resourceId in cache key
  const cacheKey = resourceId 
    ? `${audience}:${resourceId}` 
    : audience;
  
  // Check cache
  const cached = getCachedToken(userId, cacheKey, scopeArray, expiryBufferSeconds * 1000);
  if (cached) {
    if (verbose) {
      console.log('[ZERO-TRUST] Using cached token for:', { userId, audience, resourceId });
    }
    return {
      accessToken: cached.accessToken,
      tokenType: cached.tokenType,
      expiresIn: Math.floor((cached.expiresAt - Date.now()) / 1000),
      scope: cached.scope,
      expiresAt: cached.expiresAt,
    };
  }

  // Build token exchange request (Zero Trust - no client credentials)
  const params = new URLSearchParams({
    grant_type: TOKEN_EXCHANGE_GRANT,
    subject_token: sessionJwt,
    subject_token_type: SUBJECT_TOKEN_TYPE_JWT,
    audience,
    scope: scopeString,
  });

  // Add optional purpose for audit
  if (purpose) {
    params.set('requested_purpose', purpose);
  }
  
  // Add resourceId for app-scoped tokens
  // Authz will verify user has access to this app via RBAC bindings
  if (resourceId) {
    params.set('resource_id', resourceId);
  }

  const baseUrl = getAuthzBaseUrl(authzBaseUrl);

  if (verbose) {
    console.log('[ZERO-TRUST] Token exchange request:', {
      url: `${baseUrl}/oauth/token`,
      grant_type: TOKEN_EXCHANGE_GRANT,
      audience,
      scope: scopeString,
      resourceId,
      mode: 'subject_token (Zero Trust)',
    });
  }

  // Make the exchange request
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[ZERO-TRUST] Token exchange failed:', {
      status: response.status,
      body: text,
      userId,
      audience,
    });
    
    // Parse error code from response body
    let errorCode = 'unknown_error';
    try {
      const errorData = JSON.parse(text);
      errorCode = errorData.detail || errorData.error || 'unknown_error';
    } catch {
      // Body is not JSON, use the text as-is
      errorCode = text;
    }
    
    // Check for session-related errors that indicate the user should be logged out
    const sessionErrors = [
      'invalid_subject_token_key',
      'subject_token_expired',
      'invalid_subject_token',
      'subject_token_revoked',
      'session_revoked',
    ];
    
    if (sessionErrors.includes(errorCode)) {
      throw new InvalidSessionError(
        `Session is invalid: ${errorCode}`,
        errorCode,
        response.status
      );
    }
    
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type: 'bearer';
    expires_in: number;
    scope?: string;
  };

  const expiresIn = data.expires_in ?? 900;
  const expiresAt = Date.now() + expiresIn * 1000;

  // Cache the token (use modified cache key for app-scoped tokens)
  const cachedToken: CachedToken = {
    accessToken: data.access_token,
    tokenType: data.token_type ?? 'bearer',
    expiresAt,
    scope: data.scope ?? scopeString,
    audience: cacheKey, // Use cacheKey which includes resourceId for app-scoped tokens
  };
  setCachedToken(userId, cachedToken);

  if (verbose) {
    console.log('[ZERO-TRUST] Token cached:', { userId, audience, resourceId, expiresIn });
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type ?? 'bearer',
    expiresIn,
    scope: data.scope ?? scopeString,
    expiresAt,
  };
}

/**
 * Get an authorization header (Bearer token) using Zero Trust exchange.
 *
 * @param request - Token exchange request
 * @param config - Optional configuration
 * @returns Authorization header string (e.g., "Bearer eyJ...")
 */
export async function getAuthHeaderZeroTrust(
  request: ZeroTrustExchangeRequest,
  config?: ZeroTrustClientConfig
): Promise<string> {
  const token = await exchangeTokenZeroTrust(request, config);
  return `Bearer ${token.accessToken}`;
}

/**
 * Create a Zero Trust client instance with fixed configuration.
 *
 * This is useful when you want to reuse the same config across multiple calls.
 *
 * @param config - Client configuration
 * @returns Zero Trust client instance
 */
export function createZeroTrustClient(config?: ZeroTrustClientConfig): ZeroTrustClient {
  return {
    async exchangeToken(request: ZeroTrustExchangeRequest): Promise<ZeroTrustExchangeResponse> {
      return exchangeTokenZeroTrust(request, config);
    },

    async getAuthHeader(request: ZeroTrustExchangeRequest): Promise<string> {
      return getAuthHeaderZeroTrust(request, config);
    },

    invalidateToken(audience: string, scopes: string[] = []): void {
      // We need a userId to invalidate, but we don't have it here
      // This clears ALL tokens for this audience (could be improved with userId param)
      for (const [key] of tokenCache) {
        if (key.includes(`:${audience}:`)) {
          tokenCache.delete(key);
        }
      }
    },

    invalidateAllTokens(): void {
      invalidateAllCachedTokens();
    },
  };
}

/**
 * Invalidate a cached token for a specific user/audience/scopes combination.
 *
 * @param userId - User ID
 * @param audience - Target audience
 * @param scopes - Scopes (optional)
 */
export function invalidateZeroTrustToken(
  userId: string,
  audience: string,
  scopes: string[] = []
): void {
  invalidateCachedToken(userId, audience, scopes);
}

/**
 * Clear all cached Zero Trust tokens.
 */
export function clearZeroTrustTokenCache(): void {
  invalidateAllCachedTokens();
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Check if a token string is in JWT format.
 */
export function isValidJwtFormat(token: string): boolean {
  return isJwtFormat(token);
}

/**
 * Parse JWT claims without verification.
 * Use for extracting user ID, expiry, etc. - actual verification is done by authz.
 */
export function parseJwtClaimsUnsafe(token: string): JwtClaims | null {
  return parseJwtClaims(token);
}

/**
 * Extract user ID from a session JWT (server-only, checks "sub" only).
 *
 * For isomorphic code that also handles legacy tokens with "user_id" claim,
 * see getUserIdFromToken in auth-helper.ts.
 */
export function getUserIdFromSessionJwt(sessionJwt: string): string | null {
  const claims = parseJwtClaims(sessionJwt);
  return claims?.sub ?? null;
}
