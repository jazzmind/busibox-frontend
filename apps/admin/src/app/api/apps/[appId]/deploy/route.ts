/**
 * Deploy/Redeploy App API
 * 
 * POST /api/apps/[appId]/deploy - Trigger deployment for an external app
 * 
 * Supports two modes:
 * - GitHub mode: Clones from GitHub repository
 * - Local Dev mode: Uses local source from DEV_APPS_DIR
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { deployApp, validateLocalDevDirectory } from '@jazzmind/busibox-app/lib/deploy/deployment-client';
import { fetchAndValidateManifest } from '@jazzmind/busibox-app/lib/deploy/github-manifest';
import { isGitHubUrl } from '@jazzmind/busibox-app/lib/deploy/github-manifest';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import {
  getAppConfigById,
  updateAppConfig,
} from '@jazzmind/busibox-app/lib/deploy/app-config';

// AuthZ service URL for token exchange
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    
    // Exchange session token for deploy-api scoped token
    let deployToken: string;
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'deploy:write'],
          purpose: 'Deploy app',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: false,
        }
      );
      deployToken = exchangeResult.accessToken;
    } catch (exchangeError) {
      console.error('[API/deploy] Token exchange error:', exchangeError);
      return NextResponse.json(
        { success: false, error: 'Failed to authenticate with deployment service' },
        { status: 401 }
      );
    }
    const { appId } = await params;

    // Parse request body
    let githubToken: string | undefined;
    try {
      const body = await request.json();
      githubToken = body.githubToken;
    } catch {
      // No body is fine
    }

    const app = await getAppConfigById({ userId: adminUser.id, sessionJwt }, appId);

    if (!app) {
      return NextResponse.json(
        { success: false, error: 'App not found' },
        { status: 404 }
      );
    }

    // Use provided token or fall back to stored token
    const tokenToUse = githubToken || app.githubToken || undefined;

    // Only external apps can be deployed
    if (app.type !== 'EXTERNAL') {
      return NextResponse.json(
        { success: false, error: 'Only external apps can be deployed' },
        { status: 400 }
      );
    }

    if (!app.url) {
      return NextResponse.json(
        { success: false, error: 'App has no URL configured' },
        { status: 400 }
      );
    }

    // Check if this is a local dev deployment
    const isLocalDev = app.devMode && app.url.startsWith('local-dev://');
    
    let manifest: any;
    let localDevDir: string | undefined;

    if (isLocalDev) {
      // Local dev mode - get manifest from local directory
      const dirName = app.url.replace('local-dev://', '');
      
      try {
        const validationResult = await validateLocalDevDirectory(dirName, deployToken);
        
        if (!validationResult.valid || !validationResult.manifest) {
          return NextResponse.json(
            { 
              success: false, 
              error: validationResult.error || 'Failed to validate local dev directory' 
            },
            { status: 400 }
          );
        }
        
        manifest = validationResult.manifest;
        localDevDir = dirName;
      } catch (error) {
        return NextResponse.json(
          { 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to validate local dev directory' 
          },
          { status: 400 }
        );
      }
    } else {
      // GitHub mode - validate URL and fetch manifest
      if (!isGitHubUrl(app.url)) {
        return NextResponse.json(
          { success: false, error: 'App URL is not a GitHub repository' },
          { status: 400 }
        );
      }

      const manifestResult = await fetchAndValidateManifest(app.url, tokenToUse);
      
      if (!manifestResult.valid || !manifestResult.manifest) {
        return NextResponse.json(
          { 
            success: false, 
            error: manifestResult.error || 'Failed to fetch or validate manifest' 
          },
          { status: 400 }
        );
      }

      manifest = manifestResult.manifest;
    }

    // Trigger deployment
    try {
      const deployment = await deployApp({
        appId: app.id,
        appName: manifest.id,
        githubRepo: isLocalDev ? undefined : app.url,
        githubToken: isLocalDev ? undefined : tokenToUse,
        localDevDir: localDevDir,
        manifest: manifest,
        environment: 'production', // TODO: Support staging
        devMode: isLocalDev,
      }, deployToken);

      await updateAppConfig({ userId: adminUser.id, sessionJwt }, appId, {
        lastDeploymentId: deployment.deploymentId,
        lastDeploymentStatus: deployment.status,
        lastDeploymentLogs: JSON.stringify([`✓ Deployment initiated: ${deployment.deploymentId}`]),
        lastDeploymentStartedAt: new Date(),
        lastDeploymentEndedAt: null,
        lastDeploymentError: null,
      });

      return NextResponse.json({
        success: true,
        data: {
          deploymentId: deployment.deploymentId,
          status: deployment.status,
          message: 'Deployment initiated successfully',
        },
      });
    } catch (deployError) {
      console.error('[API] Deployment failed:', deployError);
      
      await updateAppConfig({ userId: adminUser.id, sessionJwt }, appId, {
        lastDeploymentStatus: 'failed',
        lastDeploymentError: deployError instanceof Error ? deployError.message : 'Deployment failed',
        lastDeploymentEndedAt: new Date(),
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: deployError instanceof Error ? deployError.message : 'Deployment failed' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API] Deploy endpoint error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
