import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getCurrentUserWithSessionFromCookies, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

async function token(sessionJwt: string): Promise<string> {
  try {
    const exchange = await exchangeTokenZeroTrust(
      { sessionJwt, audience: 'deploy-api', scopes: ['admin', 'services:write'], purpose: 'vllm unassign' },
      { authzBaseUrl: AUTHZ_BASE_URL }
    );
    return exchange.accessToken;
  } catch {
    return sessionJwt;
  }
}

interface RouteParams {
  params: Promise<{ modelKey: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) return apiError('Authentication required', 401);
    const { sessionJwt, ...user } = userWithSession;
    if (!requireAdmin(user)) return apiError('Admin access required', 403);
    const { modelKey } = await params;
    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/vllm/assignments/${encodeURIComponent(modelKey)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${await token(sessionJwt)}` },
    });
    if (!response.ok) return apiError(await response.text(), response.status);
    return apiSuccess(await response.json());
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to unassign model', 500);
  }
}
