/**
 * SSO Token Refresh API
 * 
 * POST /api/auth/sso/refresh - Silently refresh an SSO token for a sub-app
 * 
 * Called by sub-apps (busibox-agents, busibox-projects, etc.) when their SSO token
 * is expired or expiring. The browser sends the portal's session cookie
 * automatically (same origin), so no explicit auth token is needed from the
 * sub-app.
 * 
 * Returns only the token (no redirectUrl), since the caller is already in the app.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import { generateSSOToken } from '@jazzmind/busibox-app/lib/authz/sso-generator';
import { getAppByNameFromStore, getAppConfigStoreContextForUser } from '@jazzmind/busibox-app/lib/deploy/app-config';

export async function POST(request: NextRequest) {
  try {
    // Validate portal session (uses busibox-session cookie sent by browser)
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user, sessionJwt } = authResult;
    const body = await parseJsonBody(request);

    // Support both appId and appName
    let { appId } = body;
    const { appName } = body;
    
    // If appName is provided but not appId, look up the appId
    if (appName && !appId) {
      const context = await getAppConfigStoreContextForUser(user.id, sessionJwt);
      const app = await getAppByNameFromStore(context.accessToken, appName);
      
      if (!app) {
        return apiError(`App not found: ${appName}`, 404);
      }
      
      appId = app.id;
    }

    // Validate we have an appId
    if (!appId) {
      return apiError('Missing required field: appId or appName', 400);
    }

    console.log('[SSO/REFRESH] Refreshing SSO token for app:', appId, 'user:', user.id);

    // Generate fresh SSO token (reuses existing logic)
    const result = await generateSSOToken({
      id: user.id,
      email: user.email,
      roles: user.roles,
      sessionJwt,
    }, appId);

    console.log('[SSO/REFRESH] Token refreshed successfully for app:', appId);

    // Return only the token - no redirect URL needed for refresh
    return apiSuccess({
      token: result.token,
      expiresAt: result.expiresAt,
    });
  } catch (error: any) {
    console.error('[SSO/REFRESH] Token refresh error:', error);
    
    if (error.message?.includes('not found')) {
      return apiError(error.message, 404);
    }
    if (error.message?.includes('not active')) {
      return apiError(error.message, 403);
    }
    if (error.message?.includes('permission')) {
      return apiError(error.message, 403);
    }
    if (error.message?.includes('expired')) {
      return apiError('Portal session expired. Please log in again.', 401);
    }
    
    return apiError('Token refresh failed', 500);
  }
}
