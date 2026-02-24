/**
 * GET /api/auth/session
 *
 * Session endpoint for SessionProvider.
 * Validates the session JWT and returns user data.
 * Performs a lightweight token exchange against authz to confirm the session
 * is still valid server-side.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiSuccess, apiError, apiErrorRequireLogout, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;

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
      console.warn('[API/session] authz validation failed (non-fatal):', exchangeError);
    }

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
