/**
 * Admin Media Ensure API Route
 *
 * Ensures an MLX media server is running (idempotent: no-op if already healthy).
 * Proxies to deploy-api POST /api/v1/services/media/ensure -> host-agent POST /media/ensure.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getCurrentUserWithSessionFromCookies, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
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

    let adminToken = sessionJwt;
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'services:write'],
          purpose: 'media server ensure',
        },
        { authzBaseUrl: AUTHZ_BASE_URL }
      );
      adminToken = exchangeResult.accessToken;
    } catch (error) {
      console.warn('[API/media/ensure] Token exchange error:', error);
    }

    const body = await request.json();
    const { server } = body;

    if (!server || !['transcribe', 'voice', 'image'].includes(server)) {
      return apiError('Invalid server name. Must be: transcribe, voice, or image', 400);
    }

    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/media/ensure`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ server }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      if (response.status === 503) {
        return apiError('Host agent not reachable (not MLX backend)', 503);
      }
      console.error(`[API/media/ensure] Deploy-api error: ${response.status} - ${errorText}`);
      return apiError(`Failed to ensure media server: ${errorText}`, response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[API] Media ensure error:', error);
    return apiError('Failed to ensure media server', 500);
  }
}
