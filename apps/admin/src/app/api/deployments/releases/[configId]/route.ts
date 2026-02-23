/**
 * GitHub Releases for App
 * GET /api/deployments/releases/[configId] - List releases
 *
 * Proxies to deploy-api. Releases include is_currently_deployed from deploy-api.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getDeployApiToken,
  listReleases,
} from '@jazzmind/busibox-app/lib/deploy/client';

interface RouteParams {
  params: Promise<{
    configId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { user, sessionJwt } = auth;
  const { configId } = await params;

  try {
    const token = await getDeployApiToken(user.id, sessionJwt);
    const { releases } = await listReleases(token, configId);
    return NextResponse.json({ releases });
  } catch (error) {
    console.error('Failed to fetch releases:', error);
    const err = error as { status?: number };
    const status = err.status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch releases' },
      { status }
    );
  }
}
