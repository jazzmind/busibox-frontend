/**
 * SSO Authentication Library (Zero Trust JWKS)
 *
 * Validates RS256 JWT tokens issued by authz service via JWKS.
 * This is the standard authentication method for Busibox apps.
 *
 * Token Flow:
 * 1. User clicks app in Busibox Portal
 * 2. Busibox Portal exchanges user's session JWT for app-scoped token via authz
 * 3. authz verifies user has app access via RBAC bindings
 * 4. authz issues RS256 token with app_id claim and user's roles
 * 5. App validates token via authz JWKS endpoint
 *
 * Token validation is done via authz JWKS endpoint - no shared secrets needed.
 * 
 * @example
 * ```typescript
 * import { validateSSOToken, createSessionFromSSO } from '@jazzmind/busibox-app/lib/authz';
 * 
 * const validation = await validateSSOToken(token);
 * if (validation.valid) {
 *   const session = createSessionFromSSO(validation);
 * }
 * ```
 */

import * as jose from "jose";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Options for SSO token validation
 */
export interface SSOValidationOptions {
  /** Base URL for authz service (default: AUTHZ_BASE_URL env or http://authz-api:8010) */
  authzUrl?: string;
  /** Expected audience claim - app name (default: APP_NAME env or "app") */
  appName?: string;
  /** Expected issuer claim (default: "busibox-authz") */
  issuer?: string;
  /** Optional explicit audience(s), comma-separated (e.g. "projects,busibox-projects") */
  ssoAudience?: string;
}

// Default configuration from environment
const getDefaultAuthzUrl = () => process.env.AUTHZ_BASE_URL || "http://authz-api:8010";
const getDefaultAppName = () => process.env.APP_NAME || "app";
const DEFAULT_ISSUER = "busibox-authz";

// Cache JWKS for performance (keyed by authz URL)
const jwksCache: Map<string, { verifier: jose.JWTVerifyGetKey; time: number }> = new Map();
const JWKS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Types
// ============================================================================

/**
 * JWT payload structure for app-scoped tokens from authz
 */
export interface AppTokenPayload {
  iss: string; // Issuer: 'busibox-authz'
  sub: string; // Subject: user ID (UUID)
  aud: string; // Audience: app name
  iat: number; // Issued at
  exp: number; // Expiration
  jti: string; // Token ID
  scope: string; // Space-separated scopes
  roles: Array<{ id: string; name: string }>; // User's roles
  app_id?: string; // App resource ID (UUID)
  email?: string; // User's email (may be present in session tokens)
  preferred_username?: string; // Alternative email field
  name?: string; // User's display name
  // Profile fields (from session JWT claims)
  given_name?: string; // First name
  family_name?: string; // Last name
  picture?: string; // Avatar URL
  favorite_color?: string; // Favorite color
}

/**
 * Result of SSO token validation
 */
export interface SSOValidationResult {
  valid: boolean;
  userId?: string;
  email?: string;
  roles?: string[];
  appId?: string;
  scopes?: string[];
  error?: string;
  /** User profile fields from JWT claims */
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  favoriteColor?: string;
}

/**
 * Session data created from validated SSO token
 */
export interface SSOSessionData {
  userId: string;
  email: string;
  roles: string[];
  appId: string;
  scopes: string[];
  authenticatedAt: string;
  authMethod: "sso";
  /** User profile fields (optional, from JWT claims) */
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  favoriteColor?: string;
}

// ============================================================================
// JWKS Verification
// ============================================================================

/**
 * Get or create JWKS verifier from authz service
 */
async function getJwksVerifier(authzUrl: string): Promise<jose.JWTVerifyGetKey> {
  const now = Date.now();
  const cached = jwksCache.get(authzUrl);

  // Return cached JWKS if still valid
  if (cached && now - cached.time < JWKS_CACHE_TTL) {
    return cached.verifier;
  }

  // Fetch fresh JWKS from authz
  const jwksUrl = new URL("/.well-known/jwks.json", authzUrl);
  console.log("[SSO] Fetching JWKS from:", jwksUrl.toString());

  const verifier = jose.createRemoteJWKSet(jwksUrl);
  jwksCache.set(authzUrl, { verifier, time: now });

  return verifier;
}

/**
 * Invalidate JWKS cache (call this if key rotation is detected)
 */
export function invalidateJwksCache(authzUrl?: string): void {
  if (authzUrl) {
    jwksCache.delete(authzUrl);
  } else {
    jwksCache.clear();
  }
}

// ============================================================================
// Token Validation
// ============================================================================

/**
 * Validate app-scoped token from authz
 *
 * Token is RS256 signed by authz. We verify using authz JWKS endpoint.
 * No shared secrets needed - asymmetric verification.
 * 
 * Handles multiple audience formats robustly:
 * - Short app IDs (e.g., "estimator", "dredge-estimator")
 * - Display names (e.g., "Dredging Cost Estimator")
 * - Explicit path/ID audiences (e.g., "projects", "busibox-projects")
 * 
 * @param token - JWT token string
 * @param options - Validation options (authzUrl, appName, issuer)
 * @returns Validation result with user info or error
 * 
 * @example
 * ```typescript
 * // Using environment variables
 * const result = await validateSSOToken(token);
 * 
 * // With explicit options
 * const result = await validateSSOToken(token, {
 *   authzUrl: 'http://authz:8010',
 *   appName: 'My App',
 * });
 * ```
 */
export async function validateSSOToken(
  token: string,
  options?: SSOValidationOptions
): Promise<SSOValidationResult> {
  const authzUrl = options?.authzUrl || getDefaultAuthzUrl();
  const appName = options?.appName || getDefaultAppName();
  const issuer = options?.issuer || DEFAULT_ISSUER;

  try {
    const jwks = await getJwksVerifier(authzUrl);

    console.log(`[SSO] Validating token with expected audience: "${appName}"`);
    
    // Debug: Log current time vs token expiration
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        const now = Math.floor(Date.now() / 1000);
        const exp = payload.exp;
        const iat = payload.iat;
        console.log(`[SSO] Token timing - Now: ${now}, Issued: ${iat}, Expires: ${exp}, Age: ${now - iat}s, TTL: ${exp - now}s`);
      }
    } catch (e) {
      // Ignore parsing errors
    }

    // Verify and decode token WITHOUT strict audience check
    // We'll validate audience manually for more flexibility
    // Add clock tolerance to handle clock skew between services
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer,
      clockTolerance: 60, // Allow 60 seconds clock skew
      // Don't enforce audience in jwtVerify - we'll check manually
    });

    const appToken = payload as unknown as AppTokenPayload;
    
    // Manual audience validation with flexible matching
    const tokenAud = appToken.aud;
    
    // Build list of acceptable audiences for this app.
    // Security: do not include global legacy wildcards like "Busibox App".
    const acceptedAudiences: string[] = [];
    const addAudience = (value: string | null | undefined): void => {
      const normalized = (value || "").trim();
      if (!normalized) return;
      if (!acceptedAudiences.some((aud) => aud.toLowerCase() === normalized.toLowerCase())) {
        acceptedAudiences.push(normalized);
      }
    };

    // Primary configured app name
    addAudience(appName);

    // Explicit audience override(s), from options or env (comma-separated)
    const ssoAudienceConfig = options?.ssoAudience || process.env.SSO_AUDIENCE || "";
    for (const value of ssoAudienceConfig.split(",")) {
      addAudience(value);
    }

    // Deployed path audience fallback (portal often uses this format)
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    if (basePath) {
      addAudience(basePath.replace(/^\//, "").toLowerCase());
    }

    // Common variations based on appName
    if (appName) {
      addAudience(appName.toLowerCase().replace(/\s+/g, "-"));
      addAudience(
        appName
          .split(/[-_\s]+/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ")
      );
    }
    
    // Check if token audience matches any accepted audience
    const audMatch = acceptedAudiences.some(aud => {
      // Exact match
      if (tokenAud === aud) return true;
      
      // Case-insensitive match
      if (typeof tokenAud === 'string' && tokenAud.toLowerCase() === aud.toLowerCase()) return true;
      
      // Array of audiences (token can have multiple audiences)
      if (Array.isArray(tokenAud) && tokenAud.some(a => 
        a === aud || (typeof a === 'string' && a.toLowerCase() === aud.toLowerCase())
      )) return true;
      
      return false;
    });
    
    if (!audMatch) {
      console.error(`[SSO] Token audience mismatch. Expected one of:`, acceptedAudiences, `Got:`, tokenAud);
      // Create a proper error without using JWTClaimValidationFailed constructor directly
      const error = new Error('Token audience validation failed');
      error.name = 'JWTClaimValidationFailed';
      throw error;
    }
    
    console.log(`[SSO] Token audience validated:`, tokenAud);

    // Extract email from various possible claims
    // Session tokens include 'email', access tokens may not
    const email = appToken.email || 
                  appToken.preferred_username || 
                  appToken.name ||
                  ''; // Empty if not found

    console.log('[SSO] Token claims:', {
      sub: appToken.sub,
      email: appToken.email,
      preferred_username: appToken.preferred_username,
      name: appToken.name,
      roles: appToken.roles?.map((r) => r.name),
    });

    // Token is valid - extract user info including profile fields
    return {
      valid: true,
      userId: appToken.sub,
      email,
      roles: appToken.roles?.map((r) => r.name) || [],
      appId: appToken.app_id,
      scopes: appToken.scope?.split(" ").filter(Boolean) || [],
      displayName: appToken.name || undefined,
      firstName: appToken.given_name || undefined,
      lastName: appToken.family_name || undefined,
      avatarUrl: appToken.picture || undefined,
      favoriteColor: appToken.favorite_color || undefined,
    };
  } catch (error) {
    console.error("[SSO] Token validation error:", error);

    let errorMessage = "Invalid token";
    if (error instanceof jose.errors.JWTExpired) {
      errorMessage = "Token expired";
    } else if (error instanceof jose.errors.JWTClaimValidationFailed) {
      errorMessage = "Token claims validation failed";
    } else if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
      errorMessage = "Token signature verification failed";
      // Invalidate cache in case of key rotation
      invalidateJwksCache(authzUrl);
    }

    return {
      valid: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Session Management Helpers
// ============================================================================

/**
 * Create session data from validated SSO token
 * 
 * @param validation - Result from validateSSOToken
 * @returns Session data object
 * @throws Error if validation result is invalid
 */
export function createSessionFromSSO(
  validation: SSOValidationResult
): SSOSessionData {
  if (!validation.valid || !validation.userId) {
    throw new Error("Invalid SSO validation result");
  }

  return {
    userId: validation.userId,
    email: validation.email || "",
    roles: validation.roles || [],
    appId: validation.appId || "",
    scopes: validation.scopes || [],
    authenticatedAt: new Date().toISOString(),
    authMethod: "sso",
    // Profile fields from JWT claims
    displayName: validation.displayName,
    firstName: validation.firstName,
    lastName: validation.lastName,
    avatarUrl: validation.avatarUrl,
    favoriteColor: validation.favoriteColor,
  };
}

/**
 * Check if session has specific role
 */
export function hasSessionRole(
  session: { roles?: string[] },
  roleName: string
): boolean {
  return session.roles?.includes(roleName) || false;
}

/**
 * Check if session has specific scope
 */
export function hasSessionScope(
  session: { scopes?: string[] },
  scope: string
): boolean {
  return session.scopes?.includes(scope) || false;
}

/**
 * Check if session user is admin
 */
export function isSessionAdmin(session: { roles?: string[] }): boolean {
  return hasSessionRole(session, "Admin") || hasSessionRole(session, "admin");
}
