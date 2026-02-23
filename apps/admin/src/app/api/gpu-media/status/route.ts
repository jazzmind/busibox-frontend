/**
 * Admin GPU Media Status API Route
 *
 * Returns status for on-demand GPU media services (whisper-gpu, kokoro-gpu) on the vLLM host.
 * Proxies to deploy-api GET /api/v1/services/gpu-media/status.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getCurrentUserWithSessionFromCookies, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function GET(request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) return apiError('Authentication required', 401);

    const { sessionJwt, ...user } = userWithSession;
    if (!requireAdmin(user)) return apiError('Admin access required', 403);

    let adminToken = sessionJwt;
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        { sessionJwt, audience: 'deploy-api', scopes: ['admin', 'services:read'], purpose: 'gpu-media status' },
        { authzBaseUrl: AUTHZ_BASE_URL }
      );
      adminToken = exchangeResult.accessToken;
    } catch {
      // fall back to session JWT
    }

    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/gpu-media/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (!response.ok) {
      if (response.status === 503 || response.status === 404) {
        return apiSuccess({ available: false, servers: {} });
      }
      const text = await response.text().catch(() => response.statusText);
      return apiError(`GPU media status error: ${text}`, response.status);
    }

    return apiSuccess(await response.json());
  } catch (error) {
    console.error('[API] gpu-media/status error:', error);
    return apiSuccess({ available: false, servers: {} });
  }
}
