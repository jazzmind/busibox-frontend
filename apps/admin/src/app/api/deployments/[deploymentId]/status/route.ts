/**
 * Deployment Status
 * GET /api/deployments/[deploymentId]/status - Get deployment status
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
      deployment: {
        id: deployment.id,
        status: deployment.status,
        releaseTag: deployment.release_tag ?? deployment.releaseTag,
        environment: deployment.environment,
        startedAt: deployment.started_at ?? deployment.startedAt,
        completedAt: deployment.completed_at ?? deployment.completedAt,
        errorMessage: deployment.error_message ?? deployment.errorMessage,
        isRollback: deployment.is_rollback ?? deployment.isRollback,
      },
    });
  } catch (error) {
    console.error('Failed to fetch deployment status:', error);
    const err = error as { status?: number };
    const status = err.status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch status' },
      { status }
    );
  }
}
