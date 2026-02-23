/**
 * Deployment Status API
 * 
 * GET /api/apps/[appId]/deploy/[deploymentId]/status
 * 
 * Get real-time deployment status from the deploy service.
 * Also persists status/logs to database for page refresh resilience.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import { getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';
import {
  getAppConfigById,
  updateAppConfig,
} from '@jazzmind/busibox-app/lib/deploy/app-config';

const DEPLOYMENT_SERVICE_URL = process.env.DEPLOYMENT_SERVICE_URL || 
  (process.env.NODE_ENV === 'production' ? 'http://10.96.200.210:8011/api/v1/deployment' : 'http://localhost:8011/api/v1/deployment');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string; deploymentId: string }> }
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user, sessionJwt } = authResult;
    const { appId, deploymentId } = await params;

    // Exchange session token for deploy-api scoped token
    const exchangeResult = await exchangeTokenZeroTrust(
      {
        sessionJwt,
        audience: 'deploy-api',
        scopes: ['admin', 'deploy:read'],
        purpose: 'Get deployment status',
      },
      {
        authzBaseUrl: getAuthzBaseUrl(),
        verbose: false,
      }
    );
    const deployToken = exchangeResult.accessToken;

    // Fetch status from deployment service
    const response = await fetch(
      `${DEPLOYMENT_SERVICE_URL}/deploy/${deploymentId}/status`,
      {
        headers: {
          'Authorization': `Bearer ${deployToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Deployment not found in service - check database for cached status
        const app = await getAppConfigById({ userId: user.id, sessionJwt }, appId);
        
        if (app?.lastDeploymentId === deploymentId) {
          // Return cached status
          let logs: string[] = [];
          try {
            logs = app.lastDeploymentLogs ? JSON.parse(app.lastDeploymentLogs) : [];
          } catch {
            logs = app.lastDeploymentLogs ? [app.lastDeploymentLogs] : [];
          }
          
          return NextResponse.json({
            deploymentId,
            status: app.lastDeploymentStatus || 'unknown',
            logs,
            error: app.lastDeploymentError,
            startedAt: app.lastDeploymentStartedAt,
            completedAt: app.lastDeploymentEndedAt,
            cached: true,
          });
        }
        
        return NextResponse.json(
          { error: 'Deployment not found' },
          { status: 404 }
        );
      }
      
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(
        { error: error.detail || 'Failed to get deployment status' },
        { status: response.status }
      );
    }

    const status = await response.json();

    // Persist status to database for page refresh resilience
    const isComplete = status.status === 'completed' || status.status === 'failed';
    
    await updateAppConfig({ userId: user.id, sessionJwt }, appId, {
      lastDeploymentStatus: status.status,
      lastDeploymentLogs: JSON.stringify(status.logs || []),
      lastDeploymentError: status.error || null,
      ...(isComplete ? { lastDeploymentEndedAt: new Date() } : {}),
    });

    return NextResponse.json(status);
  } catch (error) {
    console.error('[API] Get deployment status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
