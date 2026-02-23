/**
 * POST /api/services/token
 * 
 * Get an exchanged token for deploy-api WebSocket connections.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function POST(request: NextRequest) {
  try {
    // Get user with roles from session JWT
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    
    if (!userWithSession) {
      return apiError('Authentication required', 401);
    }

    const { sessionJwt, ...user } = userWithSession;

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    // Exchange session token for admin-scoped token via authz
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'deployment:manage', 'services:manage'],
          purpose: 'Service deployment via WebSocket',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: true,
        }
      );
      
      return apiSuccess({ token: exchangeResult.accessToken });
    } catch (exchangeError) {
      // If the session is invalid (e.g., signing key changed), require logout
      if (isInvalidSessionError(exchangeError)) {
        console.error('[API/services/token] Session is invalid - user should log out:', exchangeError);
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code
        );
      }
      console.error('[API/services/token] Token exchange failed:', exchangeError);
      // Fall back to session token for other errors
      return apiSuccess({ token: sessionJwt });
    }
  } catch (error) {
    console.error('[API/services/token] Error:', error);
    return apiError('Failed to get token', 500);
  }
}
