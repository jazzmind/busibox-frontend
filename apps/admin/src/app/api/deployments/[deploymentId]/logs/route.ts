/**
 * Deployment Logs
 * GET /api/deployments/[deploymentId]/logs - Get deployment logs
 *
 * Proxies to deploy-api.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getDeployApiToken,
  getDeployment,
} from '@jazzmind/busibox-app/lib/deploy/client';

interface RouteParams {
  params: Promise<{
    deploymentId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { user, sessionJwt } = auth;
  const { deploymentId } = await params;

  try {
    const token = await getDeployApiToken(user.id, sessionJwt);
    const { deployment } = await getDeployment(token, deploymentId);
    return NextResponse.json({
      logs: deployment.logs ?? '',
      status: deployment.status,
      errorMessage: deployment.error_message ?? deployment.errorMessage ?? null,
    });
  } catch (error) {
    console.error('Failed to fetch deployment logs:', error);
    const err = error as { status?: number };
    const status = err.status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch logs' },
      { status }
    );
  }
}
