/**
 * Admin GPU Status API Route
 *
 * Returns NVIDIA GPU VRAM utilization and per-model assignments from Proxmox/vLLM.
 * Proxies to deploy-api GET /api/v1/services/gpu/status.
 * Returns empty/unavailable gracefully when not on a GPU backend.
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
          purpose: 'gpu status check',
        },
        { authzBaseUrl: AUTHZ_BASE_URL }
      );
      adminToken = exchangeResult.accessToken;
    } catch (error) {
      console.warn('[API/gpu/status] Token exchange error:', error);
    }

    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/gpu/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    if (!response.ok) {
      // 503 / 404 = GPU status endpoint not available (non-GPU or MLX backend)
      if (response.status === 503 || response.status === 404) {
        return apiSuccess({ available: false, gpus: [] });
      }
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[API/gpu/status] Deploy-api error: ${response.status} - ${errorText}`);
      return apiError(`Failed to get GPU status: ${errorText}`, response.status);
    }

    const data = await response.json();
    return apiSuccess({ available: true, ...data });
  } catch (error) {
    console.error('[API] Get GPU status error:', error);
    // Return empty instead of error so the dashboard card fails gracefully
    return apiSuccess({ available: false, gpus: [] });
  }
}
