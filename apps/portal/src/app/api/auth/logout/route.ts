/**
 * POST /api/auth/logout
 * GET /api/auth/logout (for redirect-based logout)
 * 
 * Log out the current user and invalidate their session.
 * Zero Trust: Session deletion uses the user's session JWT for authentication.
 * 
 * POST: API-style logout, returns JSON
 * GET: Redirect-style logout, clears cookie and redirects to login
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import { logUserLogout } from '@jazzmind/busibox-app/lib/authz/audit';
import { deleteSession } from '@jazzmind/busibox-app';
import { getAuthzOptions } from '@jazzmind/busibox-app/lib/authz/next-client';

/**
 * GET /api/auth/logout
 * 
 * Redirect-style logout. Used when we need to log out via URL redirect
 * (e.g., when session is invalid and we need to force re-login).
 */
function getRedirectBase(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL
    || request.url;
}

export async function GET(request: NextRequest) {
  try {
    // Try to get session JWT to delete it from authz
    const sessionJwt = getSessionJwt(request);
    
    if (sessionJwt) {
      try {
        // Attempt to delete session from authz
        await deleteSession(sessionJwt, getAuthzOptions());
      } catch (error) {
        // Ignore errors - session may already be invalid
        console.warn('[API/logout] Could not delete session from authz:', error instanceof Error ? error.message : error);
      }
    }

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const response = NextResponse.redirect(new URL(`${basePath}/login`, getRedirectBase(request)));
    response.cookies.delete('busibox-session');

    return response;
  } catch (error) {
    console.error('[API] GET Logout error:', error);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const response = NextResponse.redirect(new URL(`${basePath}/login`, getRedirectBase(request)));
    response.cookies.delete('busibox-session');
    return response;
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    // If not authenticated, requireAuth returns error response
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;

    // Delete session from authz service using the session JWT
    const deleted = await deleteSession(sessionJwt, getAuthzOptions());
    
    if (deleted) {
      // Log logout
      await logUserLogout(user.id, sessionJwt);
    }

    // Create response and clear session cookie
    const response = NextResponse.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });

    response.cookies.delete('busibox-session');

    return response;
  } catch (error) {
    console.error('[API] Logout error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
