/**
 * Reconnect GitHub Account
 * POST /api/github/reconnect - Force reconnect to refresh token with updated permissions
 * Proxies to deploy-api.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDeployApiToken, reconnectGitHub } from '@jazzmind/busibox-app/lib/deploy/client';

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const token = await getDeployApiToken(auth.user.id, auth.sessionJwt);
    const data = await reconnectGitHub(token);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to reconnect GitHub:', error);
    return NextResponse.json(
      { error: 'Failed to clear GitHub connection' },
      { status: 500 }
    );
  }
}
