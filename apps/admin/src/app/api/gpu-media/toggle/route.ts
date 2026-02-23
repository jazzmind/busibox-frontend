/**
 * Admin GPU Media Toggle API Route
 *
 * Start/stop on-demand GPU media services (whisper-gpu, kokoro-gpu) on the vLLM host.
 * Proxies to deploy-api POST /api/v1/services/gpu-media/toggle.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, getCurrentUserWithSessionFromCookies, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function POST(request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) return apiError('Authentication required', 401);

    const { sessionJwt, ...user } = userWithSession;
    if (!requireAdmin(user)) return apiError('Admin access required', 403);

    let adminToken = sessionJwt;
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        { sessionJwt, audience: 'deploy-api', scopes: ['admin', 'services:write'], purpose: 'gpu-media toggle' },
        { authzBaseUrl: AUTHZ_BASE_URL }
      );
      adminToken = exchangeResult.accessToken;
    } catch {
      // fall back to session JWT
    }

    const body = await request.json();

    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/gpu-media/toggle`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      return apiError(`GPU media toggle error: ${text}`, response.status);
    }

    return apiSuccess(await response.json());
  } catch (error) {
    console.error('[API] gpu-media/toggle error:', error);
    return apiError('Failed to toggle GPU media service', 500);
  }
}
