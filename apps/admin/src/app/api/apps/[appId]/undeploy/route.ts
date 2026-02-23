/**
 * Undeploy App API
 * 
 * POST /api/apps/[appId]/undeploy - Remove deployed app and clean up resources
 * 
 * This endpoint cleans up:
 * - Running process
 * - Docker volumes (node_modules, .next cache)
 * - nginx configuration
 * - Build artifacts
 * 
 * Use this when:
 * - Deployment failed due to package-lock.json sync errors
 * - You need to clean up volumes that are blocking file operations
 * - You want to completely remove an app from the system
 * 
 * After undeploying, you can redeploy with a fresh state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { undeployApp } from '@jazzmind/busibox-app/lib/deploy/deployment-client';
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
          purpose: 'Undeploy app',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: false,
        }
      );
      deployToken = exchangeResult.accessToken;
    } catch (exchangeError) {
      console.error('[API/undeploy] Token exchange error:', exchangeError);
      return NextResponse.json(
        { success: false, error: 'Failed to authenticate with deployment service' },
        { status: 401 }
      );
    }

    const { appId } = await params;

    // Parse request body
    let removeVolumes = true;
    try {
      const body = await request.json();
      if (typeof body.removeVolumes === 'boolean') {
        removeVolumes = body.removeVolumes;
      }
    } catch {
      // No body is fine, use defaults
    }

    const app = await getAppConfigById({ userId: adminUser.id, sessionJwt }, appId);

    if (!app) {
      return NextResponse.json(
        { success: false, error: 'App not found' },
        { status: 404 }
      );
    }

    console.log(`[API/undeploy] Undeploying app ${appId} by user ${adminUser.id}`);

    // Trigger undeploy
    try {
      const result = await undeployApp(appId, deployToken, removeVolumes);

      if (result.success) {
        await updateAppConfig({ userId: adminUser.id, sessionJwt }, appId, {
          lastDeploymentStatus: 'undeployed',
          lastDeploymentLogs: JSON.stringify(result.logs),
          lastDeploymentEndedAt: new Date(),
          lastDeploymentError: null,
        });
      } else {
        await updateAppConfig({ userId: adminUser.id, sessionJwt }, appId, {
          lastDeploymentStatus: 'undeploy_failed',
          lastDeploymentLogs: JSON.stringify(result.logs),
          lastDeploymentEndedAt: new Date(),
          lastDeploymentError: result.error || 'Undeploy failed',
        });
      }

      return NextResponse.json({
        success: result.success,
        data: {
          appId: result.appId,
          logs: result.logs,
        },
        error: result.error,
      });
    } catch (undeployError) {
      console.error('[API/undeploy] Undeploy failed:', undeployError);
      
      return NextResponse.json(
        { 
          success: false, 
          error: undeployError instanceof Error ? undeployError.message : 'Undeploy failed' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API/undeploy] Endpoint error:', error);
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
