/**
 * GET  /api/services/core-dev-mode - Per-app dev/prod mode status
 * POST /api/services/core-dev-mode - Toggle mode for one or all apps
 *
 * Communicates with the app-manager process running inside the core-apps
 * container via deploy-api, which proxies to the control API on port 9999.
 *
 * Fallback: when deploy-api is unreachable (e.g. first install), returns
 * a basic response derived from the CORE_APPS_MODE environment variable.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import { getDeployApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

const IS_PRODUCTION = process.env.NEXT_PUBLIC_BUSIBOX_ENV === 'production';
const DEPLOY_API_URL = process.env.DEPLOY_API_URL || getDeployApiUrl();
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

async function getDeployApiToken(sessionJwt: string): Promise<string> {
  try {
    const result = await exchangeTokenZeroTrust(
      { sessionJwt, audience: 'deploy-api', scopes: ['admin', 'services:write'], purpose: 'Core dev mode control' },
      { authzBaseUrl: AUTHZ_BASE_URL, verbose: false },
    );
    return result.accessToken;
  } catch {
    return sessionJwt;
  }
}

export async function GET(_request: NextRequest) {
  try {
    if (IS_PRODUCTION) {
      return apiSuccess({ enabled: false, currentMode: 'prod', apps: {} });
    }

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

    const token = await getDeployApiToken(sessionJwt);

    try {
      const res = await fetch(`${DEPLOY_API_URL}/api/v1/services/core-apps/dev-mode`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        return apiSuccess(data?.data || data);
      }
    } catch {
      // deploy-api unreachable — fall through to env-var fallback
    }

    const currentMode = process.env.CORE_APPS_MODE ?? 'prod';
    const isDevMode = currentMode === 'dev';
    return apiSuccess({
      enabled: isDevMode,
      currentMode,
      apps: {},
      fallback: true,
      description: isDevMode
        ? 'Core Developer Mode ON: Turbopack hot-reload active. App-manager status unavailable.'
        : 'Core Developer Mode OFF: Running as standalone production build.',
    });
  } catch (error) {
    console.error('[API/services/core-dev-mode] Error:', error);
    return apiError('Failed to get core developer mode status', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (IS_PRODUCTION) {
      return apiError('Dev mode toggling is not available in production', 403);
    }

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
    const token = await getDeployApiToken(sessionJwt);

    const res = await fetch(`${DEPLOY_API_URL}/api/v1/services/core-apps/dev-mode`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return apiError(errData.detail || errData.error || `Deploy-api returned ${res.status}`, res.status);
    }

    const data = await res.json();
    return apiSuccess(data?.data || data);
  } catch (error) {
    console.error('[API/services/core-dev-mode] POST error:', error);
    return apiError('Failed to toggle dev mode', 500);
  }
}
