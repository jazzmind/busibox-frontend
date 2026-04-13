/**
 * List Local Dev Apps
 * GET /api/apps/local-dev-apps
 * 
 * Returns the DEV_APPS_DIR path and lists all subdirectories that contain
 * valid busibox.json manifest files.
 * 
 * This endpoint calls the deploy-api which has access to the mounted dev-apps directory.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

// Deployment service URL — use BUSIBOX_ENVIRONMENT, not NODE_ENV, to pick the right host
const DEPLOYMENT_SERVICE_URL = process.env.DEPLOYMENT_SERVICE_URL || 
  (['production', 'staging'].includes(process.env.BUSIBOX_ENVIRONMENT || '') 
    ? 'http://10.96.200.210:8011/api/v1/deployment' 
    : 'http://localhost:8011/api/v1/deployment');

// AuthZ service URL for token exchange
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

// Get the configured DEV_APPS_DIR from environment
// Falls back to parent of the project directory (e.g. /Users/you/Code)
// unless running on actual production infrastructure (BUSIBOX_ENVIRONMENT=production)
function getDevAppsDir(): string {
  if (process.env.DEV_APPS_DIR) {
    return process.env.DEV_APPS_DIR;
  }
  
  const busiboxEnv = process.env.BUSIBOX_ENVIRONMENT || '';
  if (busiboxEnv !== 'production' && busiboxEnv !== 'staging') {
    return process.cwd().replace(/\/[^/]+$/, '');
  }
  
  return '';
}

export interface LocalDevApp {
  dirName: string;
  manifest: {
    name: string;
    id: string;
    version: string;
    description?: string;
    icon?: string;
    defaultPath: string;
    defaultPort?: number;
    appMode?: 'frontend' | 'prisma' | 'custom';
    services?: Array<{ name: string; port: number; path: string }>;
  };
}

export interface LocalDevAppsResponse {
  devAppsDir: string;
  apps: LocalDevApp[];
  error?: string;
  localDevSupported: boolean;  // Whether local dev mode is supported in this environment
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (authResult instanceof Response) return authResult;
  
  const { sessionJwt } = authResult;
  const devAppsDir = getDevAppsDir();
  
  // Local dev mode is only blocked in actual production/staging deployments
  // (identified by BUSIBOX_ENVIRONMENT). NODE_ENV=production just means the
  // admin app is running in optimized mode -- it doesn't mean we're on a
  // production server, so it should NOT gate dev-mode user-app installs.
  const busiboxEnv = process.env.BUSIBOX_ENVIRONMENT || '';
  const localDevSupported = busiboxEnv !== 'production' && busiboxEnv !== 'staging';
  
  if (!localDevSupported) {
    return NextResponse.json({
      devAppsDir: '',
      apps: [],
      localDevSupported: false,
      error: 'Local development mode is not available in production deployments.',
    });
  }
  
  try {
    // Exchange session token for deploy-api scoped token
    let deployToken: string;
    
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'deploy:read'],
          purpose: 'List local dev apps',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: false,
        }
      );
      
      deployToken = exchangeResult.accessToken;
    } catch (exchangeError) {
      console.warn('[API/local-dev-apps] Token exchange error:', exchangeError);
      return NextResponse.json({
        devAppsDir,
        apps: [],
        localDevSupported,
        error: 'Failed to authenticate with deployment service',
      });
    }
    
    // Call the deploy service to list available apps
    try {
      const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/list-local-dev-apps`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${deployToken}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return NextResponse.json({
          devAppsDir,
          apps: [],
          localDevSupported,
          error: error.detail || `Failed to list apps: ${response.statusText}`,
        });
      }
      
      const result = await response.json();
      
      return NextResponse.json({
        devAppsDir: result.devAppsDir || devAppsDir,
        apps: result.apps || [],
        localDevSupported,
      });
    } catch (fetchError) {
      console.error('[API/local-dev-apps] Deploy service error:', fetchError);
      return NextResponse.json({
        devAppsDir,
        apps: [],
        localDevSupported,
        error: 'Cannot connect to deployment service. Make sure docker services are running.',
      });
    }
  } catch (error) {
    console.error('[API/local-dev-apps] Error:', error);
    return NextResponse.json(
      { 
        devAppsDir,
        apps: [],
        localDevSupported,
        error: error instanceof Error ? error.message : 'Failed to list local dev apps',
      },
      { status: 500 }
    );
  }
}
