/**
 * Admin vLLM Status API Route
 *
 * Returns comprehensive vLLM cluster status: per-port model servers, GPU VRAM, and media models.
 * Proxies to deploy-api GET /api/v1/services/vllm/status.
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
        { sessionJwt, audience: 'deploy-api', scopes: ['admin', 'services:read'], purpose: 'vllm status' },
        { authzBaseUrl: AUTHZ_BASE_URL }
      );
      adminToken = exchangeResult.accessToken;
    } catch {
      // fall back to session JWT
    }

    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/vllm/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (!response.ok) {
      if (response.status === 503 || response.status === 404) {
        return apiSuccess({ available: false, models: [], media: [], gpus: [] });
      }
      const text = await response.text().catch(() => response.statusText);
      return apiError(`vLLM status error: ${text}`, response.status);
    }

    return apiSuccess(await response.json());
  } catch (error) {
    console.error('[API] vllm/status error:', error);
    return apiSuccess({ available: false, models: [], media: [], gpus: [] });
  }
}
