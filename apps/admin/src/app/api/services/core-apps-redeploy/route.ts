/**
 * POST /api/services/core-apps-redeploy
 *
 * Trigger a full cache-clearing redeploy of all core apps.
 * Stops all apps, cleans node_modules caches, runs pnpm install,
 * rebuilds shared packages and all apps, then restarts them.
 *
 * GET /api/services/core-apps-redeploy
 *
 * Poll whether a redeploy is currently in progress.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import { getDeployApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

const DEPLOY_API_URL = process.env.DEPLOY_API_URL || getDeployApiUrl();
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

async function getAuthToken() {
  const userWithSession = await getCurrentUserWithSessionFromCookies();
  if (!userWithSession) return { error: apiError('Authentication required', 401) };
  if (isInvalidSessionError(userWithSession)) return { error: apiErrorRequireLogout('Session expired') };

  const { sessionJwt, ...user } = userWithSession;
  if (!requireAdmin(user)) return { error: apiError('Admin access required', 403) };

  let token = sessionJwt;
  try {
    const result = await exchangeTokenZeroTrust(
      { sessionJwt, audience: 'deploy-api', scopes: ['admin', 'services:write'], purpose: 'Redeploy core apps' },
      { authzBaseUrl: AUTHZ_BASE_URL, verbose: false },
    );
    token = result.accessToken;
  } catch {}

  return { token };
}

export async function POST() {
  try {
    const auth = await getAuthToken();
    if ('error' in auth && auth.error) return auth.error;

    const res = await fetch(`${DEPLOY_API_URL}/api/v1/services/core-apps/redeploy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });

    if (res.status >= 400) {
      const errData = await res.json().catch(() => ({}));
      return apiError(errData.detail || errData.error || `Deploy-api returned ${res.status}`, res.status);
    }

    const data = await res.json();
    return apiSuccess(data?.data || data);
  } catch (error) {
    console.error('[API/services/core-apps-redeploy] POST Error:', error);
    return apiError('Failed to start redeploy', 500);
  }
}

export async function GET() {
  try {
    const auth = await getAuthToken();
    if ('error' in auth && auth.error) return auth.error;

    const res = await fetch(`${DEPLOY_API_URL}/api/v1/services/core-apps/redeploy`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${auth.token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return apiError(errData.detail || errData.error || `Deploy-api returned ${res.status}`, res.status);
    }

    const data = await res.json();
    return apiSuccess(data?.data || data);
  } catch (error) {
    console.error('[API/services/core-apps-redeploy] GET Error:', error);
    return apiError('Failed to check redeploy status', 500);
  }
}
