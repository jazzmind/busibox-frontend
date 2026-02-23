/**
 * Delete App Secret
 * DELETE /api/deployments/secrets/[secretId]
 * Proxies to deploy-api.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDeployApiToken, deleteSecret } from '@jazzmind/busibox-app/lib/deploy/client';

interface RouteParams {
  params: Promise<{
    secretId: string;
  }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { secretId } = await params;

  try {
    const token = await getDeployApiToken(auth.user.id, auth.sessionJwt);
    await deleteSecret(token, secretId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete secret:', error);
    return NextResponse.json({ error: 'Failed to delete secret' }, { status: 500 });
  }
}
