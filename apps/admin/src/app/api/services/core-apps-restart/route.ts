/**
 * POST /api/services/core-apps-restart
 *
 * Restart an individual core app without changing its dev/prod mode.
 * Proxies to deploy-api -> app-manager control API.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import { getDeployApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

const DEPLOY_API_URL = process.env.DEPLOY_API_URL || getDeployApiUrl();
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function POST(request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) {
      return apiError('Authentication required', 401);
    }

    if (isInvalidSessionError(userWithSession)) {
      return apiErrorRequireLogout('Session expired');
    }

    const { sessionJwt, ...user } = userWithSession;
    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    const body = await request.json();
    if (!body.app) {
      return apiError('Missing "app" field', 400);
    }

    let token = sessionJwt;
    try {
      const result = await exchangeTokenZeroTrust(
        { sessionJwt, audience: 'deploy-api', scopes: ['admin', 'services:write'], purpose: 'Restart core app' },
        { authzBaseUrl: AUTHZ_BASE_URL, verbose: false },
      );
      token = result.accessToken;
    } catch {}

    const res = await fetch(`${DEPLOY_API_URL}/api/v1/services/core-apps/restart`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: body.app }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return apiError(errData.detail || errData.error || `Deploy-api returned ${res.status}`, res.status);
    }

    const data = await res.json();
    return apiSuccess(data?.data || data);
  } catch (error) {
    console.error('[API/services/core-apps-restart] Error:', error);
    return apiError('Failed to restart app', 500);
  }
}
