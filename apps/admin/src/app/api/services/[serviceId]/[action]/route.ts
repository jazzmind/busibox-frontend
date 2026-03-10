/**
 * POST /api/services/:serviceId/:action
 * 
 * Control a service (start, stop, restart).
 * Proxies to deploy-api's /system/services/{service}/{action} endpoints.
 * Uses Zero Trust token exchange for authentication.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import { getDeployApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

const DEPLOY_API_URL = process.env.DEPLOY_API_URL || getDeployApiUrl();
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

const VALID_ACTIONS = ['start', 'stop', 'restart'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string; action: string }> }
) {
  try {
    const { serviceId, action } = await params;

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

    if (!VALID_ACTIONS.includes(action)) {
      return apiError(`Invalid action: ${action}. Must be one of: ${VALID_ACTIONS.join(', ')}`, 400);
    }

    let token = sessionJwt;
    try {
      const result = await exchangeTokenZeroTrust(
        { sessionJwt, audience: 'deploy-api', scopes: ['admin', 'services:write'], purpose: `${action} service ${serviceId}` },
        { authzBaseUrl: AUTHZ_BASE_URL, verbose: false },
      );
      token = result.accessToken;
    } catch (exchangeError) {
      if (isInvalidSessionError(exchangeError)) {
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code,
        );
      }
    }

    const response = await fetch(`${DEPLOY_API_URL}/system/services/${serviceId}/${action}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return apiError(errorData.detail || errorData.message || `Failed to ${action} service`, response.status);
    }

    const result = await response.json();

    return apiSuccess({
      serviceId,
      action,
      result,
    });
  } catch (error) {
    console.error('[API] Service action error:', error);
    return apiError('Failed to perform service action', 500);
  }
}
