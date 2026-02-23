/**
 * POST /api/services/transcribe-token
 * 
 * Get an exchanged token for agent-api real-time transcription WebSocket.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function POST(request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    
    if (!userWithSession) {
      return apiError('Authentication required', 401);
    }

    const { sessionJwt, ...user } = userWithSession;

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'agent-api',
          scopes: ['audio:transcribe'],
          purpose: 'Real-time audio transcription via WebSocket',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: true,
        }
      );
      
      return apiSuccess({ token: exchangeResult.accessToken });
    } catch (exchangeError) {
      if (isInvalidSessionError(exchangeError)) {
        console.error('[API/services/transcribe-token] Session is invalid:', exchangeError);
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code
        );
      }
      console.error('[API/services/transcribe-token] Token exchange failed:', exchangeError);
      return apiSuccess({ token: sessionJwt });
    }
  } catch (error) {
    console.error('[API/services/transcribe-token] Error:', error);
    return apiError('Failed to get transcription token', 500);
  }
}
