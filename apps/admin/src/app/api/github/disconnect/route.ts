/**
 * Disconnect GitHub
 * DELETE /api/github/disconnect
 * Proxies to deploy-api.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDeployApiToken, disconnectGitHub } from '@jazzmind/busibox-app/lib/deploy/client';

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const token = await getDeployApiToken(auth.user.id, auth.sessionJwt);
    await disconnectGitHub(token);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to disconnect GitHub:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
