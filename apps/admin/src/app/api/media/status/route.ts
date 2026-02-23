/**
 * Admin Media Status API Route
 *
 * Returns status for all MLX media servers (transcribe, voice, image) with memory info.
 * Proxies to deploy-api GET /api/v1/services/media/status -> host-agent GET /media/status.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getCurrentUserWithSessionFromCookies, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';
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

    let adminToken = sessionJwt;
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'services:read'],
          purpose: 'media status check',
        },
        { authzBaseUrl: AUTHZ_BASE_URL }
      );
      adminToken = exchangeResult.accessToken;
    } catch (error) {
      console.warn('[API/media/status] Token exchange error:', error);
    }

    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/media/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      // 503 = host-agent not available (non-MLX backend) - return empty status gracefully
      if (response.status === 503) {
        return apiSuccess({ available: false, message: 'Host agent not reachable (not MLX backend)' });
      }
      console.error(`[API/media/status] Deploy-api error: ${response.status} - ${errorText}`);
      return apiError(`Failed to get media status: ${errorText}`, response.status);
    }

    const data = await response.json();
    return apiSuccess({ available: true, ...data });
  } catch (error) {
    console.error('[API] Get media status error:', error);
    return apiError('Failed to get media status', 500);
  }
}
