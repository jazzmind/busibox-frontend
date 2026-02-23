/**
 * Sync GitHub Releases
 * POST /api/deployments/releases/[configId]/sync
 *
 * Proxies to deploy-api.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getDeployApiToken,
  syncReleases,
} from '@jazzmind/busibox-app/lib/deploy/client';

interface RouteParams {
  params: Promise<{
    configId: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { user, sessionJwt } = auth;
  const { configId } = await params;

  try {
    const token = await getDeployApiToken(user.id, sessionJwt);
    const { success, count, releases } = await syncReleases(token, configId);
    return NextResponse.json({ success, count, releases });
  } catch (error) {
    console.error('Failed to sync releases:', error);
    const err = error as { status?: number };
    const status = err.status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync releases' },
      { status }
    );
  }
}
