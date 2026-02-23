/**
 * Authentication Helper Utilities
 *
 * Provides JWT token management including:
 * - Token extraction from requests (Next.js compatible)
 * - Token validation and parsing
 * - Header generation
 * - Role and scope checking
 * 
 * @example
 * ```typescript
 * import { 
 *   getTokenFromRequest, 
 *   parseJWTPayload,
 *   getUserIdFromToken 
 * } from '@jazzmind/busibox-app/lib/authz';
 * 
 * // In an API route
 * const token = getTokenFromRequest(request);
 * const userId = getUserIdFromToken(token);
 * ```
 */

// ==========================================================================
// Types for Next.js compatibility without hard dependency
// ==========================================================================

/**
 * Minimal request interface compatible with Next.js NextRequest
 */
interface RequestLike {
  headers: {
    get(name: string): string | null;
  };
  cookies: {
    get(name: string): { value: string } | undefined;
  };
}

// ==========================================================================
// TOKEN EXTRACTION
// ==========================================================================

/**
 * Extract session JWT from request
 *
 * Zero Trust Architecture:
 * - Checks Authorization header first (Bearer token)
 * - Then checks app-specific auth token cookie (e.g., "myapp-auth-token")
 * - Falls back to generic auth_token cookie (legacy, may be polluted by other apps)
 * - Falls back to busibox-session cookie (portal token - may not validate for app-specific checks)
 *
 * IMPORTANT: Each app should use its own cookie name (${appName}-auth-token) to prevent
 * cross-app token pollution when multiple apps are hosted on the same domain.
 *
 * @param request - Next.js NextRequest or compatible request object
 * @param appName - Optional app name for cookie lookup (default: APP_NAME env or "app")
 * @returns Token string or undefined if not found
 */
/**
 * Sanitize app name for use in cookie names
 * 
 * Converts to lowercase, replaces spaces with hyphens, removes special characters.
 * This ensures consistent cookie naming across all Busibox apps.
 * 
 * @example
 * sanitizeAppName("Data Analysis") // "data-analysis"
 * sanitizeAppName("Agent Manager") // "busibox-agents"
 * sanitizeAppName("my-app") // "my-app"
 */
export function sanitizeAppName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function getTokenFromRequest(request: RequestLike, appName?: string): string | undefined {
  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // IMPORTANT: Check app-specific auth_token FIRST
  // Each app has its own cookie (e.g., "estimator-auth-token") to prevent
  // cross-app token pollution when multiple apps are on the same domain
  // Sanitize the name to handle spaces and special characters
  const rawName = appName || process.env.APP_NAME || "app";
  const name = sanitizeAppName(rawName);
  const appTokenCookie = request.cookies.get(`${name}-auth-token`);
  if (appTokenCookie) {
    return appTokenCookie.value;
  }

  // Legacy fallback: generic auth_token (may be polluted by other apps on same domain)
  const tokenCookie = request.cookies.get("auth_token");
  if (tokenCookie) {
    return tokenCookie.value;
  }

  // Fallback to busibox-session (shared portal token)
  // Note: This will have audience "portal" which may not validate for app-specific checks
  const sessionCookie = request.cookies.get("busibox-session");
  if (sessionCookie) {
    return sessionCookie.value;
  }

  const accessTokenCookie = request.cookies.get("access_token");
  if (accessTokenCookie) {
    return accessTokenCookie.value;
  }

  return undefined;
}

/**
 * Get session data from app-session cookie
 * 
 * @param request - Next.js NextRequest or compatible request object
 * @param appName - App name for cookie lookup (default: APP_NAME env or "app")
 */
export function getSessionFromRequest(
  request: RequestLike,
  appName?: string
): { 
  userId: string; 
  email: string; 
  roles: string[];
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  favoriteColor?: string;
} | null {
  const rawName = appName || process.env.APP_NAME || "app";
  const name = sanitizeAppName(rawName);
  const sessionCookie = request.cookies.get(`${name}-session`);
  if (!sessionCookie) {
    return null;
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    return {
      userId: session.userId || session.user_id,
      email: session.email,
      roles: session.roles || [],
      displayName: session.displayName,
      firstName: session.firstName,
      lastName: session.lastName,
      avatarUrl: session.avatarUrl,
      favoriteColor: session.favoriteColor,
    };
  } catch {
    return null;
  }
}

/**
 * Require token or throw authentication error
 */
export function requireToken(request: RequestLike): string {
  const token = getTokenFromRequest(request);
  if (!token) {
    throw new Error("Authentication token required");
  }
  return token;
}

// ==========================================================================
// HEADER GENERATION
// ==========================================================================

/**
 * Generate authorization headers for API requests
 */
export function getAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Generate headers for SSE (Server-Sent Events) requests
 */
export function getSSEHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

// ==========================================================================
// TOKEN VALIDATION (without cryptographic verification)
// ==========================================================================

/**
 * Check if token is present (basic validation)
 */
export function hasToken(request: RequestLike): boolean {
  return getTokenFromRequest(request) !== undefined;
}

/**
 * Parse JWT token payload (without verification).
 *
 * Isomorphic: works in both browser (atob) and Node.js (Buffer).
 * For server-only code, see also parseJwtClaims / parseJwtClaimsUnsafe
 * in zero-trust.ts which uses base64url decoding.
 * 
 * WARNING: This does NOT verify the signature. Use only for reading claims.
 * For verified validation, use validateSSOToken from './sso'.
 */
export function parseJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    // Use atob for browser compatibility, Buffer for Node.js
    let decoded: string;
    if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(payload, "base64").toString("utf-8");
    } else if (typeof atob !== 'undefined') {
      decoded = atob(payload);
    } else {
      return null;
    }
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Failed to parse JWT payload:", error);
    return null;
  }
}

/**
 * Check if token is expired (based on exp claim)
 * 
 * WARNING: This does NOT verify the signature.
 */
export function isTokenExpired(token: string): boolean {
  const payload = parseJWTPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    return true;
  }

  const expirationTime = payload.exp * 1000;
  return Date.now() >= expirationTime;
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  const payload = parseJWTPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    return null;
  }

  return new Date(payload.exp * 1000);
}

/**
 * Get user ID from token (sub or user_id claim).
 *
 * Isomorphic. Checks both "sub" and "user_id" claims for compatibility
 * with different token formats. For server-only code that only handles
 * authz session JWTs (which always use "sub"), see getUserIdFromSessionJwt
 * in zero-trust.ts.
 */
export function getUserIdFromToken(token: string): string | null {
  const payload = parseJWTPayload(token);
  if (!payload) {
    return null;
  }

  const sub = payload.sub;
  const userId = payload.user_id;
  
  if (typeof sub === "string") return sub;
  if (typeof userId === "string") return userId;
  return null;
}

/**
 * Get user email from token
 */
export function getUserEmailFromToken(token: string): string | null {
  const payload = parseJWTPayload(token);
  if (!payload) {
    return null;
  }

  const email = payload.email || payload.preferred_username || payload.name;
  return typeof email === "string" ? email : null;
}

/**
 * Get user roles from token
 * 
 * Handles various role formats:
 * - Array of strings: ["Admin", "User"]
 * - Array of objects: [{ name: "Admin" }, { name: "User" }]
 * - Single string: "Admin"
 */
export function getUserRolesFromToken(token: string): string[] {
  const payload = parseJWTPayload(token);
  if (!payload) {
    return [];
  }

  const roles = payload.roles || payload.role || [];

  if (!Array.isArray(roles)) {
    return typeof roles === "string" ? [roles] : [];
  }

  return roles.map((role: unknown) => {
    if (typeof role === "string") {
      return role;
    }
    if (role && typeof role === "object" && "name" in role) {
      return String((role as { name: unknown }).name);
    }
    return String(role);
  });
}

/**
 * Check if token user has specific role
 * 
 * Note: For RBAC role checks against the authz service, use hasRole from '@jazzmind/busibox-app/lib/authz'.
 * This function is for quick client-side checks based on token claims.
 */
export function tokenHasRole(token: string, role: string): boolean {
  const roles = getUserRolesFromToken(token);
  return roles.includes(role);
}

/**
 * Check if token user is admin
 * 
 * Note: For RBAC admin checks against the authz service, use isAdmin from '@jazzmind/busibox-app/lib/authz'.
 * This function is for quick client-side checks based on token claims.
 */
export function tokenIsAdmin(token: string): boolean {
  return tokenHasRole(token, "admin") || tokenHasRole(token, "Admin");
}

// ==========================================================================
// TOKEN REFRESH
// ==========================================================================

/**
 * Check if token needs refresh (within buffer time of expiration)
 * 
 * @param token - JWT token string
 * @param bufferMinutes - Minutes before expiration to trigger refresh (default: 5)
 */
export function shouldRefreshToken(
  token: string,
  bufferMinutes: number = 5
): boolean {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    return false;
  }

  const bufferMs = bufferMinutes * 60 * 1000;
  return Date.now() >= expiration.getTime() - bufferMs;
}

// ==========================================================================
// SCOPE VALIDATION
// ==========================================================================

/**
 * Get scopes from token
 * 
 * Handles both space-separated string (OAuth2 standard) and array formats.
 */
export function getScopesFromToken(token: string): string[] {
  const payload = parseJWTPayload(token);
  if (!payload) {
    return [];
  }

  const scopes = payload.scope || payload.scopes || [];

  // Handle space-separated string (OAuth2 standard)
  if (typeof scopes === "string") {
    return scopes.split(" ").filter(Boolean);
  }

  return Array.isArray(scopes) ? scopes.map(String) : [];
}

/**
 * Check if token has specific scope
 */
export function hasScope(token: string, scope: string): boolean {
  const scopes = getScopesFromToken(token);
  return scopes.includes(scope);
}

/**
 * Check if token has all required scopes
 */
export function hasAllScopes(token: string, requiredScopes: string[]): boolean {
  const scopes = getScopesFromToken(token);
  return requiredScopes.every((scope) => scopes.includes(scope));
}
