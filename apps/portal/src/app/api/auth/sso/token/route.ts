/**
 * SSO Token Generation API
 * 
 * POST /api/auth/sso/token - Generate SSO token for external app access
 *
 * Error codes returned in the response body (errorCode field):
 * - "not_deployed": App exists but has no deployed URL yet
 * - "no_permission": User's roles do not grant access to this app
 * - "not_found": App does not exist
 * - "not_active": App is disabled
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import { generateSSOToken } from '@jazzmind/busibox-app/lib/authz/sso-generator';
import { getAppByNameFromStore, getAppConfigStoreContextForUser } from '@jazzmind/busibox-app/lib/deploy/app-config';

function apiErrorWithCode(error: string, errorCode: string, status: number) {
  return NextResponse.json({ success: false, error, errorCode }, { status });
}

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
        return apiErrorWithCode(`App not found: ${appName}`, 'not_found', 404);
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

    // Build redirect URL with token and optional app theme colors
    let redirectUrl: string | null = null;
    if (result.appUrl) {
      const params = new URLSearchParams({ token: result.token });
      if (result.primaryColor) params.set('themeColor', result.primaryColor);
      if (result.secondaryColor) params.set('themeSecondary', result.secondaryColor);
      redirectUrl = `${result.appUrl}?${params.toString()}`;
    }

    return apiSuccess({
      token: result.token,
      expiresAt: result.expiresAt,
      redirectUrl,
      notDeployed: !result.appUrl,
    });
  } catch (error: any) {
    console.error('[API] SSO token generation error:', error);
    
    if (error.message?.includes('not found')) {
      return apiErrorWithCode(error.message, 'not_found', 404);
    }
    if (error.message?.includes('not active')) {
      return apiErrorWithCode(error.message, 'not_active', 403);
    }
    if (error.message?.includes('permission')) {
      return apiErrorWithCode('You do not have access to this app. Contact your administrator to request access.', 'no_permission', 403);
    }
    
    return apiError('An unexpected error occurred', 500);
  }
}
