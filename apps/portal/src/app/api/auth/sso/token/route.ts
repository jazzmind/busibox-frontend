/**
 * SSO Token Generation API
 * 
 * POST /api/auth/sso/token - Generate SSO token for external app access
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import { generateSSOToken } from '@jazzmind/busibox-app/lib/authz/sso-generator';
import { getAppByNameFromStore, getAppConfigStoreContextForUser } from '@jazzmind/busibox-app/lib/deploy/app-config';

export async function POST(request: NextRequest) {
  try {
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

    // Generate SSO token with user info from session
    const result = await generateSSOToken({
      id: user.id,
      email: user.email,
      roles: user.roles,
      sessionJwt,
    }, appId);

    // Build redirect URL with token
    const redirectUrl = result.appUrl 
      ? `${result.appUrl}?token=${encodeURIComponent(result.token)}`
      : null;

    return apiSuccess({
      token: result.token,
      expiresAt: result.expiresAt,
      redirectUrl,
    });
  } catch (error: any) {
    console.error('[API] SSO token generation error:', error);
    
    // Return specific error messages
    if (error.message?.includes('not found')) {
      return apiError(error.message, 404);
    }
    if (error.message?.includes('not active')) {
      return apiError(error.message, 403);
    }
    if (error.message?.includes('permission')) {
      return apiError(error.message, 403);
    }
    
    return apiError('An unexpected error occurred', 500);
  }
}
