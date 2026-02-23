/**
 * Authentication Middleware Helpers
 * 
 * Zero Trust Authentication Architecture:
 * - Session tokens are RS256-signed JWTs from authz
 * - JWTs can be verified locally or validated against authz for revocation check
 * - Session JWTs are used as subject_token for downstream token exchange
 * 
 * Quiet Mode: Set X-Quiet-Logs header to suppress verbose middleware logging.
 * Useful for polling endpoints to reduce log noise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession, isInvalidSessionError, type AuthClientOptions, type Session } from '@jazzmind/busibox-app';
import { isAdmin as rbacIsAdmin } from '@jazzmind/busibox-app';
import type { AuthenticatedUser } from '../../types/next-auth';

// Re-export the error checker for convenience
export { isInvalidSessionError };

// Session cookie name - contains RS256-signed JWT from authz
const SESSION_COOKIE_NAME = 'busibox-session';

/**
 * Check if logging should be suppressed for this request
 * Looks for X-Quiet-Logs header (value can be anything truthy like "1" or "true")
 */
function shouldQuietLogs(request: NextRequest): boolean {
  const quietHeader = request.headers.get('x-quiet-logs');
  return !!quietHeader;
}

/**
 * Conditional logger that respects quiet mode
 */
function log(request: NextRequest, ...args: unknown[]): void {
  if (!shouldQuietLogs(request)) {
    console.log(...args);
  }
}

function isNextPrerenderBailout(error: unknown): boolean {
  const anyErr = error as { digest?: unknown; message?: unknown };
  const digest = typeof anyErr?.digest === 'string' ? anyErr.digest : '';
  if (digest === 'NEXT_PRERENDER_INTERRUPTED' || digest === 'HANGING_PROMISE_REJECTION') return true;

  const msg = typeof anyErr?.message === 'string' ? anyErr.message : '';
  return (
    msg.includes('needs to bail out of prerendering') ||
    msg.includes('cookies() rejects when the prerender is complete') ||
    msg.includes('fetch() rejects when the prerender is complete')
  );
}

// Import shared authz options
import { getAuthzOptions } from '../authz/next-client';

function getAuthOptions(): AuthClientOptions {
  return getAuthzOptions();
}

// ============================================================================
// Session Validation
// ============================================================================

/**
 * Parse a JWT without verification (to extract claims).
 * Full verification happens at authz during token exchange.
 */
function parseJwtClaims(token: string): { 
  sub: string; 
  email?: string; 
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  favorite_color?: string;
  jti: string; 
  exp: number; 
  typ: string;
  roles?: Array<{ id: string; name: string }>;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a token looks like a JWT (has 3 parts separated by dots)
 */
function isJwtFormat(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every(p => p.length > 0);
}

/**
 * Get session JWT from request cookies.
 * Returns the raw JWT string for use in token exchange.
 * 
 * @param request - Next.js request object
 * @returns Session JWT string or null
 */
export function getSessionJwt(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value || null;
}

/**
 * Get session JWT from cookies (for Server Components)
 */
export async function getSessionJwtFromCookies(): Promise<string | null> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
  } catch {
    return null;
  }
}

/**
 * Get current session from request.
 * Zero Trust: All sessions are RS256-signed JWTs from authz.
 * JWT claims are validated locally (signature verification happens at token exchange).
 * 
 * @param request - Next.js request object
 * @returns Session object or null if not authenticated
 */
export async function getSession(request: NextRequest) {
  try {
    const sessionToken = getSessionJwt(request);
    
    if (!sessionToken) {
      log(request, '[MIDDLEWARE] No session token found in cookies');
      return null;
    }

    // Zero Trust: All sessions must be JWTs
    if (!isJwtFormat(sessionToken)) {
      log(request, '[MIDDLEWARE] Session token is not a JWT - rejecting');
      return null;
    }

    const claims = parseJwtClaims(sessionToken);
    
    if (!claims || claims.typ !== 'session') {
      log(request, '[MIDDLEWARE] Invalid JWT session token format');
      return null;
    }
    
    // Check expiration locally (basic validation)
    if (claims.exp * 1000 < Date.now()) {
      log(request, '[MIDDLEWARE] Session JWT expired');
      return null;
    }
    
    // Extract roles from JWT claims (now embedded in session JWT)
    const roles = claims.roles || [];
    
    log(request, '[MIDDLEWARE] JWT session token validated locally:', JSON.stringify({
      user_id: claims.sub,
      session_id: claims.jti,
      email: claims.email,
      roles_count: roles.length,
    }));
    
    // Return session info from JWT claims
    return {
      user: {
        id: claims.sub,
        email: claims.email || '',
        status: 'ACTIVE', // Session JWT means user is active
        roles: roles, // Roles from JWT claims
      },
      session: {
        id: claims.jti,
        token: sessionToken, // The JWT itself
        expiresAt: new Date(claims.exp * 1000),
      },
    };
  } catch (error) {
    if (!isNextPrerenderBailout(error)) {
      console.error('[MIDDLEWARE] Error getting session:', error);
    }
    return null;
  }
}

/**
 * Get current user from session
 * 
 * Uses roles embedded in the session JWT - no additional API calls needed.
 * 
 * @param request - Next.js request object
 * @returns Authenticated user with roles or null
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const session = await getSession(request);
  
  if (!session?.user) return null;
  const claims = parseJwtClaims(session.session.token);

  // Roles are now embedded in the session JWT as objects {id, name}
  const rawRoles = session.user.roles || [];
  
  // Handle both formats: array of objects {id, name} or array of strings
  const roleNames = rawRoles.map((r: { id: string; name: string } | string) => {
    if (typeof r === 'string') return r;
    return r?.name || '';
  }).filter(Boolean);
  
  const result = {
    id: session.user.id,
    email: session.user.email,
    status: session.user.status || 'ACTIVE',
    roles: roleNames,
    displayName: claims?.name,
    firstName: claims?.given_name,
    lastName: claims?.family_name,
    avatarUrl: claims?.picture,
    favoriteColor: claims?.favorite_color,
  };
  
  log(request, '[MIDDLEWARE/getCurrentUser] User from session JWT:', JSON.stringify({
    id: result.id,
    email: result.email,
    status: result.status,
    rolesCount: result.roles.length,
  }));
  
  return result;
}

/**
 * Get basic session user (without roles lookup)
 * Useful for endpoints that just need user identity
 * 
 * @param request - Next.js request object
 * @returns Basic user info or null
 */
export async function getSessionUser(request: NextRequest): Promise<{ id: string; email: string } | null> {
  const session = await getSession(request);
  
  if (!session?.user) return null;

  return {
    id: session.user.id,
    email: session.user.email,
  };
}

export interface AuthenticatedUserWithSession extends AuthenticatedUser {
  sessionJwt: string;
}

/**
 * Get current user from cookies (for Server Components)
 *
 * @returns Authenticated user with roles or null
 */
export async function getCurrentUserFromCookies(): Promise<AuthenticatedUser | null> {
  const result = await getCurrentUserWithSessionFromCookies();
  return result
    ? {
        id: result.id,
        email: result.email,
        status: result.status,
        roles: result.roles,
        displayName: result.displayName,
        firstName: result.firstName,
        lastName: result.lastName,
        avatarUrl: result.avatarUrl,
        favoriteColor: result.favoriteColor,
      }
    : null;
}

/**
 * Get current user with session JWT from cookies (for Server Components that need Zero Trust exchange)
 * 
 * User roles are embedded directly in the session JWT - no additional API calls needed.
 *
 * @returns Authenticated user with roles and session JWT, or null
 */
export async function getCurrentUserWithSessionFromCookies(): Promise<AuthenticatedUserWithSession | null> {
  try {
    const sessionToken = await getSessionJwtFromCookies();

    if (!sessionToken) {
      return null;
    }

    // Session must be JWT for Zero Trust
    if (!isJwtFormat(sessionToken)) {
      console.error('[MIDDLEWARE] Session token is not a JWT - Zero Trust requires JWT sessions');
      return null;
    }

    const claims = parseJwtClaims(sessionToken);

    if (!claims || claims.typ !== 'session') {
      return null;
    }

    // Check expiration
    if (claims.exp * 1000 < Date.now()) {
      return null;
    }

    const userId = claims.sub;
    const userEmail = claims.email || '';
    
    // Roles are now embedded in the session JWT as objects {id, name}
    const rawRoles = claims.roles || [];
    
    // Handle both formats: array of objects {id, name} or array of strings
    const roleNames = rawRoles.map((r: { id: string; name: string } | string) => {
      if (typeof r === 'string') return r;
      return r?.name || '';
    }).filter(Boolean);

    return {
      id: userId,
      email: userEmail,
      status: 'ACTIVE',
      roles: roleNames,
      displayName: claims.name,
      firstName: claims.given_name,
      lastName: claims.family_name,
      avatarUrl: claims.picture,
      favoriteColor: claims.favorite_color,
      sessionJwt: sessionToken,
    };
  } catch (error) {
    if (!isNextPrerenderBailout(error)) {
      console.error('[MIDDLEWARE] Error getting current user from cookies:', error);
    }
    return null;
  }
}

// ============================================================================
// Route Protection Middleware
// ============================================================================

/**
 * Require authentication for a route
 * Returns 401 if not authenticated
 * 
 * @param request - Next.js request object
 * @returns User object if authenticated, or error response
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: AuthenticatedUser; sessionJwt: string } | NextResponse> {
  // Get session which may convert opaque token to JWT via authz validation
  const session = await getSession(request);
  
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized - Please sign in' },
      { status: 401 }
    );
  }
  
  // session.token is now the JWT (either from cookie or from authz validation)
  const sessionJwt = session.session.token;
  
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized - Please sign in' },
      { status: 401 }
    );
  }

  if (user.status !== 'ACTIVE') {
    return NextResponse.json(
      { success: false, error: 'Unauthorized - Account is not active' },
      { status: 403 }
    );
  }

  return { user, sessionJwt };
}

/**
 * Require admin role for a route
 * Returns 401 if not authenticated, 403 if not admin
 * 
 * Uses roles from the session JWT first (faster), falls back to authz service.
 * 
 * @param request - Next.js request object
 * @returns User object if admin, or error response
 */
export async function requireAdminAuth(
  request: NextRequest
): Promise<{ user: AuthenticatedUser; sessionJwt: string } | NextResponse> {
  const authResult = await requireAuth(request);

  // If not authenticated, return auth error
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user, sessionJwt } = authResult;

  // Validate user ID is a valid UUID before calling RBAC functions
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!user.id || !uuidRegex.test(user.id)) {
    console.error(`[MIDDLEWARE] Invalid user ID format: ${user.id}`);
    return NextResponse.json(
      { success: false, error: 'Invalid user ID format' },
      { status: 400 }
    );
  }

  // Check if user has Admin role - use JWT roles first (faster), fallback to authz service
  let isAdmin = user.roles?.includes('Admin') || false;
  
  // If not found in JWT roles, verify with authz service (in case roles were updated after login)
  if (!isAdmin) {
    log(request, '[MIDDLEWARE] Admin not in JWT roles, checking authz service');
    isAdmin = await rbacIsAdmin(user.id, getAuthzOptions());
  }

  if (!isAdmin) {
    log(request, `[MIDDLEWARE] Admin access denied for user ${user.id}, roles: ${JSON.stringify(user.roles)}`);
    return NextResponse.json(
      { success: false, error: 'Forbidden - Admin access required' },
      { status: 403 }
    );
  }

  return { user, sessionJwt };
}

// ============================================================================
// Auth + Token Exchange (for API routes calling downstream services)
// ============================================================================

export { type AuthzAudience };

export interface AuthWithTokenResult {
  user: AuthenticatedUser;
  sessionJwt: string;
  apiToken: string;
  isTestUser?: boolean;
}

/**
 * Require authentication AND exchange the session JWT for a downstream API token.
 *
 * Combines session validation with Zero Trust token exchange in a single call.
 * Use this in API routes that need to call downstream services (agent-api, data-api, etc.).
 *
 * Falls back to TEST_SESSION_JWT env var for local development when no token is present.
 *
 * @param request - Next.js request object
 * @param audience - Target service audience (defaults to DEFAULT_API_AUDIENCE env or 'backend-api')
 * @param scopes - Optional scopes to request
 * @returns Auth result with user info and API token, or 401 NextResponse
 */
export async function requireAuthWithTokenExchange(
  request: NextRequest,
  audience?: AuthzAudience,
  scopes?: string[]
): Promise<AuthWithTokenResult | NextResponse> {
  const targetAudience = audience || (process.env.DEFAULT_API_AUDIENCE as AuthzAudience) || 'backend-api';

  try {
    const ssoToken = getTokenFromRequest(request);

    if (!ssoToken) {
      const testSessionJwt = process.env.TEST_SESSION_JWT;

      if (testSessionJwt) {
        console.log('[AUTH] No SSO token found, using TEST_SESSION_JWT for local development');

        const token = await getApiToken(testSessionJwt, targetAudience, scopes);
        const claims = parseJwtClaims(testSessionJwt);

        return {
          user: {
            id: claims?.sub || 'test-user',
            email: claims?.email || 'test@localhost',
            status: 'ACTIVE',
            roles: (claims?.roles || []).map((r: { id: string; name: string } | string) =>
              typeof r === 'string' ? r : r?.name || ''
            ).filter(Boolean),
          },
          sessionJwt: testSessionJwt,
          apiToken: token,
          isTestUser: true,
        };
      }

      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in through the Busibox Portal and try again. For local testing, set TEST_SESSION_JWT to a valid session JWT.',
        },
        { status: 401 }
      );
    }

    const token = await getApiToken(ssoToken, targetAudience, scopes);
    const claims = parseJwtClaims(ssoToken);

    return {
      user: {
        id: claims?.sub || '',
        email: claims?.email || '',
        status: 'ACTIVE',
        roles: (claims?.roles || []).map((r: { id: string; name: string } | string) =>
          typeof r === 'string' ? r : r?.name || ''
        ).filter(Boolean),
      },
      sessionJwt: ssoToken,
      apiToken: token,
      isTestUser: false,
    };
  } catch (error: unknown) {
    console.error('[AUTH] Token exchange failed:', error);

    if (isInvalidSessionError(error)) {
      return apiErrorRequireLogout(
        'Your session is no longer valid. Please log in again.',
        (error as { code?: string }).code
      );
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: 'Authentication failed',
        message: 'Failed to authenticate with the backend service. Please return to the Busibox Portal and log in again.',
        details: errorMessage,
      },
      { status: 401 }
    );
  }
}

/**
 * Optional authentication with token exchange.
 *
 * Returns auth result if a valid session exists, null otherwise.
 * Use for endpoints that work with or without authentication.
 *
 * @param request - Next.js request object
 * @param audience - Target service audience
 * @param scopes - Optional scopes to request
 * @returns Auth result or null
 */
export async function optionalAuthWithTokenExchange(
  request: NextRequest,
  audience?: AuthzAudience,
  scopes?: string[]
): Promise<AuthWithTokenResult | null> {
  const targetAudience = audience || (process.env.DEFAULT_API_AUDIENCE as AuthzAudience) || 'backend-api';

  try {
    const ssoToken = getTokenFromRequest(request);

    if (!ssoToken) {
      const testSessionJwt = process.env.TEST_SESSION_JWT;

      if (testSessionJwt) {
        const token = await getApiToken(testSessionJwt, targetAudience, scopes);
        const claims = parseJwtClaims(testSessionJwt);

        return {
          user: {
            id: claims?.sub || 'test-user',
            email: claims?.email || 'test@localhost',
            status: 'ACTIVE',
            roles: (claims?.roles || []).map((r: { id: string; name: string } | string) =>
              typeof r === 'string' ? r : r?.name || ''
            ).filter(Boolean),
          },
          sessionJwt: testSessionJwt,
          apiToken: token,
          isTestUser: true,
        };
      }

      return null;
    }

    const token = await getApiToken(ssoToken, targetAudience, scopes);
    const claims = parseJwtClaims(ssoToken);

    return {
      user: {
        id: claims?.sub || '',
        email: claims?.email || '',
        status: 'ACTIVE',
        roles: (claims?.roles || []).map((r: { id: string; name: string } | string) =>
          typeof r === 'string' ? r : r?.name || ''
        ).filter(Boolean),
      },
      sessionJwt: ssoToken,
      apiToken: token,
      isTestUser: false,
    };
  } catch (error: unknown) {
    console.error('[AUTH] Optional auth failed:', error);
    return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simple helper to check if a user has Admin role.
 * 
 * Used after getSessionUser() for a simple role check without full authentication.
 * For full admin auth with JWT validation, use requireAdminAuth() instead.
 * 
 * @param user - User object with roles array
 * @returns true if user has Admin role
 */
export function requireAdmin(user: { id?: string; email?: string; roles?: string[] } | null): boolean {
  if (!user) return false;
  return user.roles?.includes('Admin') || false;
}

/**
 * Extract IP address from request
 * 
 * @param request - Next.js request object
 * @returns IP address string
 */
export function getIpAddress(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    undefined
  );
}

/**
 * Extract user agent from request
 * 
 * @param request - Next.js request object
 * @returns User agent string
 */
export function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * Create success API response
 * 
 * @param data - Response data
 * @param status - HTTP status code
 * @returns NextResponse
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}

/**
 * Create error API response
 * 
 * @param error - Error message
 * @param status - HTTP status code
 * @returns NextResponse
 */
export function apiError(error: string, status = 400) {
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}

/**
 * Create error API response that signals the client should logout.
 * 
 * Used when the session is permanently invalid (e.g., signing key changed,
 * token expired, token revoked). The client should clear cookies and redirect
 * to login.
 * 
 * Response includes `requireLogout: true` flag that client apps should check.
 * Also clears the session cookie to help with immediate logout.
 * 
 * @param error - Error message
 * @param errorCode - Machine-readable error code (e.g., 'invalid_subject_token_key')
 * @returns NextResponse with 401 status and logout signal
 */
export function apiErrorRequireLogout(error: string, errorCode?: string) {
  const response = NextResponse.json(
    { 
      success: false, 
      error,
      errorCode,
      requireLogout: true,
    },
    { status: 401 }
  );
  
  // Clear the session cookie to force logout
  response.cookies.set('busibox-session', '', {
    expires: new Date(0),
    path: '/',
  });
  
  return response;
}

/**
 * Handle errors in API routes, with special handling for invalid session errors.
 * 
 * If the error is an InvalidSessionError (e.g., token key mismatch), returns
 * a response that signals the client should logout.
 * 
 * @param error - The caught error
 * @param defaultMessage - Default error message if not an InvalidSessionError
 * @returns NextResponse
 */
export function handleApiError(error: unknown, defaultMessage = 'An error occurred') {
  // Check if this is a session error that requires logout
  if (isInvalidSessionError(error)) {
    console.error('[API] Invalid session error - user should be logged out:', error);
    return apiErrorRequireLogout(
      'Your session is no longer valid. Please log in again.',
      (error as { code?: string }).code
    );
  }
  
  // Regular error handling
  const message = error instanceof Error ? error.message : defaultMessage;
  console.error('[API] Error:', error);
  return apiError(message, 500);
}

/**
 * Parse JSON body from request safely
 * 
 * @param request - Next.js request object
 * @returns Parsed JSON or null if invalid
 */
export async function parseJsonBody(request: NextRequest): Promise<any> {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
}

/**
 * Validate required fields in request body
 * 
 * @param body - Request body object
 * @param requiredFields - Array of required field names
 * @returns Error message if validation fails, null if valid
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): string | null {
  for (const field of requiredFields) {
    if (!body || !body[field]) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

// ============================================================================
// Zero Trust Token Exchange Helpers
// ============================================================================

import {
  getAuthorizationHeaderWithSession,
  getApiToken,
  type AuthzAudience,
} from '../authz/next-client';
import { getTokenFromRequest } from '../authz/auth-helper';

/**
 * Get authorization header for downstream service using session JWT.
 * Uses Zero Trust token exchange (subject_token) - no client credentials required.
 *
 * @param request - Next.js request object
 * @param audience - Target service (e.g., 'data-api', 'search-api')
 * @param scopes - Optional scopes to request
 * @returns Authorization header string or null if not authenticated
 */
export async function getDownstreamAuth(
  request: NextRequest,
  audience: AuthzAudience,
  scopes?: string[]
): Promise<string | null> {
  const sessionToken = getSessionJwt(request);

  if (!sessionToken) {
    return null;
  }

  // Session must be a JWT for Zero Trust
  if (!isJwtFormat(sessionToken)) {
    console.error('[MIDDLEWARE] Session token is not a JWT - Zero Trust requires JWT sessions');
    return null;
  }

  const claims = parseJwtClaims(sessionToken);

  if (!claims || claims.typ !== 'session') {
    console.error('[MIDDLEWARE] Invalid session JWT: missing or wrong type');
    return null;
  }

  // Check expiration
  if (claims.exp * 1000 < Date.now()) {
    console.error('[MIDDLEWARE] Session JWT expired');
    return null;
  }

  // Use Zero Trust token exchange
  try {
    return await getAuthorizationHeaderWithSession({
      sessionJwt: sessionToken,
      userId: claims.sub,
      audience,
      scopes,
    });
  } catch (error) {
    console.error('[MIDDLEWARE] Zero Trust token exchange failed:', error);
    return null;
  }
}

/**
 * Get authorization header for downstream service from cookies (for Server Components).
 *
 * @param audience - Target service
 * @param scopes - Optional scopes
 * @returns Authorization header string or null
 */
export async function getDownstreamAuthFromCookies(
  audience: AuthzAudience,
  scopes?: string[]
): Promise<string | null> {
  const sessionToken = await getSessionJwtFromCookies();

  if (!sessionToken) {
    return null;
  }

  // Session must be a JWT for Zero Trust
  if (!isJwtFormat(sessionToken)) {
    console.error('[MIDDLEWARE] Session token is not a JWT - Zero Trust requires JWT sessions');
    return null;
  }

  const claims = parseJwtClaims(sessionToken);

  if (!claims || claims.typ !== 'session') {
    console.error('[MIDDLEWARE] Invalid session JWT: missing or wrong type');
    return null;
  }

  if (claims.exp * 1000 < Date.now()) {
    console.error('[MIDDLEWARE] Session JWT expired');
    return null;
  }

  try {
    return await getAuthorizationHeaderWithSession({
      sessionJwt: sessionToken,
      userId: claims.sub,
      audience,
      scopes,
    });
  } catch (error) {
    console.error('[MIDDLEWARE] Zero Trust token exchange failed:', error);
    return null;
  }
}
