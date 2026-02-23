/**
 * Rollback Deployment
 * POST /api/deployments/rollback
 *
 * Proxies to deploy-api.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getDeployApiToken,
  rollbackDeployment,
} from '@jazzmind/busibox-app/lib/deploy/client';

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { user, sessionJwt } = auth;

  try {
    const body = await request.json();
    const { deploymentId } = body;

    if (!deploymentId) {
      return NextResponse.json({ error: 'Missing deploymentId' }, { status: 400 });
    }

    const token = await getDeployApiToken(user.id, sessionJwt);
    const { deployment } = await rollbackDeployment(token, deploymentId);
    return NextResponse.json({ deployment }, { status: 202 });
  } catch (error) {
    console.error('Failed to rollback deployment:', error);
    const err = error as { status?: number };
    const status = err.status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rollback' },
      { status }
    );
  }
}
