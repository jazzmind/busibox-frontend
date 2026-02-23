/**
 * App Health Check API
 * 
 * GET /api/apps/health - Check health status of routed apps via deploy-api
 * 
 * Core routed apps (BUILT_IN/LIBRARY with health endpoints) are deployed by Busibox.
 * EXTERNAL apps are handled by deploy-api which has its own health checking.
 * BUILT_IN apps are internal Busibox Portal routes (no health check needed).
 * 
 * This endpoint calls deploy-api to perform the actual health checks,
 * following the same pattern as the services health check.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError, apiErrorRequireLogout } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import { listAppConfigs } from '@jazzmind/busibox-app/lib/deploy/app-config';

const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

type HealthStatus = {
  appId: string;
  appName: string;
  url: string | null;
  status: 'healthy' | 'unhealthy' | 'no-url' | 'error';
  responseTime?: number;
  statusCode?: number;
  error?: string;
};

function resolveServiceName(app: { id: string; name: string; url: string | null }): string {
  const byId: Record<string, string> = {
    'seed-busibox-agents': 'busibox-agents',
    'seed-busibox-appbuilder': 'busibox-appbuilder',
  };
  if (byId[app.id]) return byId[app.id];

  const byPath: Record<string, string> = {
    '/agents': 'busibox-agents',
    '/builder': 'busibox-appbuilder',
  };
  if (app.url && byPath[app.url]) return byPath[app.url];

  // Fallback for existing records that were named from seeded defaults.
  return app.name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Check app health via deploy-api
 */
async function checkAppHealthViaDeployApi(
  serviceName: string,
  endpoint: string,
  adminToken: string
): Promise<{ healthy: boolean; error?: string }> {
  try {
    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/health`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ service: serviceName, endpoint }),
    });

    if (!response.ok) {
      return { healthy: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    return { healthy: result.healthy || false };
  } catch (error) {
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user with roles from session JWT
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    
    if (!userWithSession) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { sessionJwt, ...user } = userWithSession;

    if (!requireAdmin(user)) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Exchange session token for admin-scoped token via authz
    let adminToken = sessionJwt;
    
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'services:read'],
          purpose: 'App health check',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: false,
        }
      );
      
      adminToken = exchangeResult.accessToken;
    } catch (exchangeError) {
      // If the session is invalid (e.g., signing key changed), require logout
      if (isInvalidSessionError(exchangeError)) {
        console.error('[API/apps/health] Session is invalid - user should log out:', exchangeError);
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code
        );
      }
      console.warn('[API/apps/health] Token exchange error, using session token:', exchangeError);
      // Fall back to session token if exchange fails for other reasons
    }

    // Get active app configs and keep only routed apps that expose health endpoints.
    // EXTERNAL apps are handled by deploy-api separately.
    const apps = (await listAppConfigs(
      { userId: user.id, sessionJwt },
      { includeDisabled: true }
    )).filter((app) => Boolean(app.url && app.healthEndpoint));

    // Check health for each routed app via deploy-api
    const startTime = Date.now();
    const healthChecks = await Promise.all(
      apps.map(async (app): Promise<HealthStatus> => {
        const appPath = app.url;
        
        if (!appPath) {
          return {
            appId: app.id,
            appName: app.name,
            url: null,
            status: 'no-url',
          };
        }

        // Use app.healthEndpoint or default to /api/health
        const healthEndpoint = app.healthEndpoint || '/api/health';
        
        // Construct full health endpoint path (e.g., /agents/api/health)
        const cleanAppPath = appPath.endsWith('/') ? appPath.slice(0, -1) : appPath;
        const fullEndpoint = `${cleanAppPath}${healthEndpoint}`;
        
        // Map seeded app metadata to deploy-api service names.
        const serviceName = resolveServiceName(app);
        
        console.log(`[Health Check] Checking ${app.name} via deploy-api (service: ${serviceName}, endpoint: ${fullEndpoint})`);
        
        const checkStart = Date.now();
        const result = await checkAppHealthViaDeployApi(serviceName, fullEndpoint, adminToken);
        const responseTime = Date.now() - checkStart;
        
        return {
          appId: app.id,
          appName: app.name,
          url: appPath,
          status: result.healthy ? 'healthy' : 'unhealthy',
          responseTime,
          error: result.error,
        };
      })
    );

    // Calculate summary statistics
    const summary = {
      total: apps.length,
      healthy: healthChecks.filter(h => h.status === 'healthy').length,
      unhealthy: healthChecks.filter(h => h.status === 'unhealthy').length,
      error: healthChecks.filter(h => h.status === 'error').length,
      noUrl: healthChecks.filter(h => h.status === 'no-url').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        checks: healthChecks,
        summary,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform health checks',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
