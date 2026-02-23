/**
 * Admin Media Toggle API Route
 *
 * Toggles an MLX media server on/off (start if stopped, stop if running).
 * Proxies to deploy-api POST /api/v1/services/media/toggle -> host-agent POST /media/toggle.
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
          purpose: 'media server toggle',
        },
        { authzBaseUrl: AUTHZ_BASE_URL }
      );
      adminToken = exchangeResult.accessToken;
    } catch (error) {
      console.warn('[API/media/toggle] Token exchange error:', error);
    }

    const body = await request.json();
    const { server } = body;

    if (!server || !['transcribe', 'voice', 'image'].includes(server)) {
      return apiError('Invalid server name. Must be: transcribe, voice, or image', 400);
    }

    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/media/toggle`, {
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
      console.error(`[API/media/toggle] Deploy-api error: ${response.status} - ${errorText}`);
      return apiError(`Failed to toggle media server: ${errorText}`, response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[API] Media toggle error:', error);
    return apiError('Failed to toggle media server', 500);
  }
}
