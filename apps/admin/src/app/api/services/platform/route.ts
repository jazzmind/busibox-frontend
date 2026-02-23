/**
 * GET /api/services/platform
 * 
 * Get platform information (backend, tier, memory) from deploy-api.
 * Used to determine which LLM runtime to use (MLX vs vLLM).
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function GET(request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) {
      return apiError('Authentication required', 401);
    }

    const { sessionJwt, ...user } = userWithSession;

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    // Exchange session token for admin-scoped token
    let adminToken = sessionJwt;
    
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'services:read'],
          purpose: 'Platform information query',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: true,
        }
      );
      
      adminToken = exchangeResult.accessToken;
    } catch (exchangeError) {
      // If the session is invalid (e.g., signing key changed), require logout
      if (isInvalidSessionError(exchangeError)) {
        console.error('[API/services/platform] Session is invalid - user should log out:', exchangeError);
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code
        );
      }
      console.warn('[API/services/platform] Token exchange error:', exchangeError);
      // Fall back to session token if exchange fails for other reasons
    }

    // Fetch platform info from deploy-api
    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/platform`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[API/services/platform] Deploy-api error: ${response.status} - ${errorText}`);
      return apiError(`Failed to get platform info: ${errorText}`, response.status);
    }

    const platformInfo = await response.json();
    return apiSuccess(platformInfo);
  } catch (error) {
    console.error('[API] Get platform info error:', error);
    return apiError('Failed to get platform information', 500);
  }
}
