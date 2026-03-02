import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getCurrentUserWithSessionFromCookies, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

async function token(sessionJwt: string): Promise<string> {
  try {
    const exchange = await exchangeTokenZeroTrust(
      { sessionJwt, audience: 'deploy-api', scopes: ['admin', 'services:write'], purpose: 'vllm assignments' },
      { authzBaseUrl: AUTHZ_BASE_URL }
    );
    return exchange.accessToken;
  } catch {
    return sessionJwt;
  }
}

export async function GET(_request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) return apiError('Authentication required', 401);
    const { sessionJwt, ...user } = userWithSession;
    if (!requireAdmin(user)) return apiError('Admin access required', 403);
    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/vllm/assignments`, {
      headers: { Authorization: `Bearer ${await token(sessionJwt)}` },
    });
    if (!response.ok) return apiError(await response.text(), response.status);
    return apiSuccess(await response.json());
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to get assignments', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) return apiError('Authentication required', 401);
    const { sessionJwt, ...user } = userWithSession;
    if (!requireAdmin(user)) return apiError('Admin access required', 403);
    const body = await request.text();
    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/vllm/assignments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await token(sessionJwt)}`, 'Content-Type': 'application/json' },
      body,
    });
    if (!response.ok) return apiError(await response.text(), response.status);
    return apiSuccess(await response.json());
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to save assignment', 500);
  }
}
