/**
 * GET /api/auth/session
 * 
 * Get current user session information.
 * 
 * User roles are embedded directly in the session JWT (set during login).
 * 
 * After local JWT validation, we attempt a lightweight token exchange against
 * authz to confirm the session is still valid server-side (catches stale signing
 * keys, revoked sessions, DB resets, etc.). If authz rejects the session, we
 * return requireLogout so the SessionProvider forces a re-login.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiSuccess, apiError, apiErrorRequireLogout, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function POST(request: NextRequest) {
  return GET(request);
}

export async function GET(request: NextRequest) {
  try {
    console.log('[API/session] GET request received');
    const authResult = await requireAuth(request);

    if (authResult instanceof Response) {
      console.log('[API/session] requireAuth returned error response');
      return authResult;
    }

    const { user, sessionJwt } = authResult;

    // Validate the session JWT against authz via a lightweight token exchange.
    // This catches sessions that pass local validation (format, expiry) but are
    // no longer recognized by authz (key rotation, DB reset, revocation).
    try {
      await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'authz-api',
          purpose: 'session-validation',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: process.env.VERBOSE_AUTHZ_LOGGING === 'true',
        }
      );
    } catch (exchangeError) {
      if (isInvalidSessionError(exchangeError)) {
        console.warn('[API/session] Session rejected by authz, forcing logout:', (exchangeError as { code?: string }).code);
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code,
        );
      }
      // Non-session errors (e.g., authz unreachable) — don't force logout,
      // let the user keep their local session until authz is back.
      console.warn('[API/session] authz validation failed (non-fatal):', exchangeError);
    }

    console.log('[API/session] User from session JWT:', JSON.stringify({
      id: user.id,
      email: user.email,
      status: user.status,
      rolesCount: user.roles?.length || 0,
    }));

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        roles: user.roles || [],
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        favoriteColor: user.favoriteColor,
      },
    });
  } catch (error) {
    console.error('[API] Session error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

