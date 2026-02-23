/**
 * Single App Deployment Configuration
 * GET /api/deployments/config/[configId] - Get config
 * PATCH /api/deployments/config/[configId] - Update config
 * DELETE /api/deployments/config/[configId] - Delete config
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getDeployApiToken,
  getDeploymentConfig,
  updateDeploymentConfig,
  deleteDeploymentConfig,
} from '@jazzmind/busibox-app/lib/deploy/client';
import { handleApiError } from '@jazzmind/busibox-app/lib/next/middleware';

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
    const { config } = await getDeploymentConfig(token, configId);
    return NextResponse.json({ config });
  } catch (error) {
    const err = error as { status?: number };
    if (err.status === 404) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }
    return handleApiError(error, 'Failed to fetch config');
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { user, sessionJwt } = auth;
  const { configId } = await params;

  try {
    const body = await request.json();
    const {
      githubBranch,
      deployPath,
      port,
      healthEndpoint,
      buildCommand,
      startCommand,
      autoDeployEnabled,
      stagingEnabled,
      stagingPort,
      stagingPath,
    } = body;

    const updates: Record<string, unknown> = {};
    if (githubBranch !== undefined) updates.github_branch = githubBranch;
    if (deployPath !== undefined) updates.deploy_path = deployPath;
    if (port !== undefined) updates.port = port;
    if (healthEndpoint !== undefined) updates.health_endpoint = healthEndpoint;
    if (buildCommand !== undefined) updates.build_command = buildCommand;
    if (startCommand !== undefined) updates.start_command = startCommand;
    if (autoDeployEnabled !== undefined) updates.auto_deploy_enabled = autoDeployEnabled;
    if (stagingEnabled !== undefined) updates.staging_enabled = stagingEnabled;
    if (stagingPort !== undefined) updates.staging_port = stagingPort;
    if (stagingPath !== undefined) updates.staging_path = stagingPath;

    if (Object.keys(updates).length === 0) {
      const token = await getDeployApiToken(user.id, sessionJwt);
      const { config } = await getDeploymentConfig(token, configId);
      return NextResponse.json({ config });
    }

    const token = await getDeployApiToken(user.id, sessionJwt);
    const { config } = await updateDeploymentConfig(token, configId, updates);
    return NextResponse.json({ config });
  } catch (error) {
    const err = error as { status?: number };
    if (err.status === 404) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }
    return handleApiError(error, 'Failed to update config');
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { user, sessionJwt } = auth;
  const { configId } = await params;

  try {
    const token = await getDeployApiToken(user.id, sessionJwt);
    await deleteDeploymentConfig(token, configId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as { status?: number };
    if (err.status === 404) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }
    return handleApiError(error, 'Failed to delete config');
  }
}
