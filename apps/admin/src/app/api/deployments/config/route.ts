/**
 * App Deployment Configuration Management
 * GET /api/deployments/config - List all configs
 * POST /api/deployments/config - Create new config
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getDeployApiToken,
  listDeploymentConfigs,
  createDeploymentConfig,
} from '@jazzmind/busibox-app/lib/deploy/client';
import { handleApiError } from '@jazzmind/busibox-app/lib/next/middleware';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { user, sessionJwt } = auth;
  try {
    const token = await getDeployApiToken(user.id, sessionJwt);
    const { configs } = await listDeploymentConfigs(token);
    return NextResponse.json({ configs });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch configs');
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { user, sessionJwt } = auth;
  try {
    const body = await request.json();
    const {
      appId,
      githubRepoOwner,
      githubRepoName,
      githubBranch = 'main',
      deployPath,
      port,
      healthEndpoint = '/api/health',
      buildCommand,
      startCommand,
      autoDeployEnabled = false,
      stagingEnabled = false,
      stagingPort,
      stagingPath,
    } = body;

    if (!appId || !githubRepoOwner || !githubRepoName || !deployPath || !port) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const token = await getDeployApiToken(user.id, sessionJwt);
    const { config } = await createDeploymentConfig(token, {
      app_id: appId,
      github_repo_owner: githubRepoOwner,
      github_repo_name: githubRepoName,
      github_branch: githubBranch,
      deploy_path: deployPath,
      port,
      health_endpoint: healthEndpoint,
      build_command: buildCommand,
      start_command: startCommand,
      auto_deploy_enabled: autoDeployEnabled,
      staging_enabled: stagingEnabled,
      staging_port: stagingPort,
      staging_path: stagingPath,
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    const err = error as { status?: number };
    if (err.status === 409) {
      return NextResponse.json(
        { error: 'App already has a deployment configuration' },
        { status: 409 }
      );
    }
    return handleApiError(error, 'Failed to create config');
  }
}
