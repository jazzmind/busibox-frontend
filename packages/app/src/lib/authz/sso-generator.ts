/**
 * SSO Token Generation (Zero Trust)
 *
 * Uses authz service OAuth2 token exchange (RFC 8693) to generate app-scoped tokens.
 * 
 * Flow:
 * 1. User requests access to an app (e.g., busibox-agents)
 * 2. busibox-portal exchanges user's session JWT with authz for an app-scoped token
 * 3. authz verifies user has access to the app via RBAC bindings
 * 4. authz issues RS256 token with app_id claim and user's roles
 * 5. External app validates token via authz JWKS: GET /.well-known/jwks.json
 * 
 * Benefits:
 * - Standardized OAuth2 flow (RFC 8693)
 * - Asymmetric signing (RS256) with JWKS
 * - Service-scoped tokens (audience enforcement)
 * - App access controlled via authz RBAC bindings
 * - Centralized audit logging
 * - No client credentials needed - JWT proves identity
 */

import { logOAuthTokenGenerated, type AuditClientOptions } from './audit';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import { getAuthzBaseUrl } from './next-client';
import { getAppByIdFromStore, getAppConfigStoreContextForUser, listAppsFromStore, resolveStableSsoAudience } from '../deploy/app-config';

/**
 * Get audit client options for server-side audit logging.
 */
function getAuditOptions(): AuditClientOptions {
  return {
    authzUrl: getAuthzBaseUrl(),
  };
}

// ============================================================================
// Types
// ============================================================================

/**
 * User info for SSO token generation
 */
export interface SSOUserInfo {
  id: string;
  email: string;
  roles: string[];
  sessionJwt: string;
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePath(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('/') ? trimmed.toLowerCase() : `/${trimmed.toLowerCase()}`;
}

function isPortalInternalBuiltInRoute(_url?: string | null): boolean {
  // In the monorepo, all built-in apps (chat, documents, admin, etc.) run as
  // separate Next.js apps with their own basePath. Nothing is portal-internal
  // anymore — all apps need SSO token exchange.
  return false;
}

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate an app-scoped access token for a user to access an external app.
 * 
 * Zero Trust Flow:
 * 1. Verify app exists and is active in busibox-portal DB
 * 2. Exchange user's session JWT for an app-scoped token via authz
 * 3. Authz verifies user has app access via RBAC bindings
 * 4. Authz issues RS256 token with app_id claim
 * 
 * The external app validates this token via authz JWKS endpoint:
 * GET {authz_url}/.well-known/jwks.json
 * 
 * @param userInfo - User info including id, email, roles, and sessionJwt
 * @param appIdentifier - App identifier (UUID, stable audience, path, or name)
 * @returns JWT token string and expiration date
 */
export async function generateSSOToken(userInfo: SSOUserInfo, appIdentifier: string): Promise<{
  token: string;
  expiresAt: Date;
  appUrl: string | null;
}> {
  // Verify app exists and is active
  const context = await getAppConfigStoreContextForUser(userInfo.id, userInfo.sessionJwt);
  const requestedIdentifier = appIdentifier.trim();
  let app = await getAppByIdFromStore(context.accessToken, requestedIdentifier);
  if (!app) {
    const allApps = await listAppsFromStore(context.accessToken);
    const normalized = normalizeIdentifier(requestedIdentifier);
    const pathLike = normalizePath(requestedIdentifier);
    app =
      allApps.find((candidate) => candidate.ssoAudience?.toLowerCase() === normalized) ||
      allApps.find((candidate) => candidate.name.toLowerCase() === normalized) ||
      allApps.find((candidate) => candidate.url?.toLowerCase() === pathLike) ||
      allApps.find((candidate) => candidate.deployedPath?.toLowerCase() === pathLike) ||
      null;
  }

  if (!app) {
    throw new Error(`App not found: ${requestedIdentifier}`);
  }

  if (!app.isActive) {
    throw new Error('App is not active');
  }

  // In the monorepo, all apps (BUILT_IN, LIBRARY, EXTERNAL) are separate
  // Next.js apps and need SSO token exchange.
  const allowSso =
    app.type === 'EXTERNAL' ||
    app.type === 'LIBRARY' ||
    app.type === 'BUILT_IN';

  if (!allowSso) {
    throw new Error('App does not support SSO authentication');
  }

  console.log('[SSO] Requesting app-scoped token from authz:', {
    userId: userInfo.id,
    requestedIdentifier,
    appId: app.id,
    appName: app.name,
    ssoAudience: app.ssoAudience,
  });

  const audience = resolveStableSsoAudience(app);

  // Exchange session JWT for app-scoped token via authz
  // Authz will verify user has access to this app via RBAC bindings
  // and issue RS256 token with app_id claim and user's roles
  try {
    const result = await exchangeTokenZeroTrust(
      {
        sessionJwt: userInfo.sessionJwt,
        audience,
        resourceId: app.id, // Canonical app UUID for RBAC check
        purpose: 'sso-app-access',
      },
      {
        authzBaseUrl: getAuthzBaseUrl(),
        verbose: process.env.VERBOSE_AUTHZ_LOGGING === 'true',
      }
    );

    const expiresAt = new Date(result.expiresAt);

    console.log('[SSO] App-scoped token issued by authz:', {
      userId: userInfo.id,
      requestedIdentifier,
      appId: app.id,
      appName: app.name,
      audience,
      expiresIn: result.expiresIn,
    });

    // Log token generation (audit failure is non-fatal)
    // Note: authz already logs the token issuance in its audit log
    try {
      const auditOptions = getAuditOptions();
      await logOAuthTokenGenerated(userInfo.id, app.id, auditOptions);
    } catch (auditError) {
      console.error('[SSO] Audit logging failed (non-fatal):', auditError);
    }

    // Determine the app URL to redirect to after SSO token exchange.
    // For deployed apps, use deployedPath (e.g., /myapp).
    // For GitHub-sourced apps not yet deployed, return null so the portal
    // can show a status message instead of redirecting to GitHub.
    let appUrl = app.url;
    if (app.deployedPath && app.lastDeploymentStatus === 'completed') {
      appUrl = app.deployedPath;
    } else if (app.url?.startsWith('local-dev://')) {
      appUrl = app.deployedPath || null;
    } else if (app.url && /^https?:\/\/(www\.)?github\.com\//i.test(app.url)) {
      appUrl = null;
    }

    return {
      token: result.accessToken,
      expiresAt,
      appUrl,
    };
  } catch (error: any) {
    // Map authz errors to user-friendly messages
    const errorMessage = error.message || String(error);
    
    if (errorMessage.includes('user_does_not_have_app_access')) {
      throw new Error('User does not have permission to access this app');
    }
    if (errorMessage.includes('403')) {
      throw new Error('User does not have permission to access this app');
    }
    if (errorMessage.includes('session_revoked') || errorMessage.includes('expired')) {
      throw new Error('Session has expired. Please log in again.');
    }
    
    console.error('[SSO] Token exchange failed:', error);
    throw new Error(`Failed to generate app token: ${errorMessage}`);
  }
}
