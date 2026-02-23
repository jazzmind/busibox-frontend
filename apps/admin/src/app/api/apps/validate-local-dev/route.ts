/**
 * Validate Local Dev Directory
 * POST /api/apps/validate-local-dev
 * 
 * Validates that a local dev directory contains a valid busibox.json manifest.
 * This calls the deploy-api to check the directory in the user-apps container.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { validateManifest } from '@jazzmind/busibox-app/lib/deploy/manifest-schema';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

// Deployment service URL
const DEPLOYMENT_SERVICE_URL = process.env.DEPLOYMENT_SERVICE_URL || 
  (process.env.NODE_ENV === 'production' ? 'http://10.96.200.210:8011/api/v1/deployment' : 'http://localhost:8011/api/v1/deployment');

// AuthZ service URL for token exchange
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (authResult instanceof Response) return authResult;
  
  const { sessionJwt } = authResult;
  
  try {
    const body = await request.json();
    const { dirName } = body;
    
    if (!dirName) {
      return NextResponse.json(
        { valid: false, error: 'Directory name is required' },
        { status: 400 }
      );
    }
    
    // Validate directory name format
    if (!/^[a-z0-9-_]+$/.test(dirName)) {
      return NextResponse.json({
        valid: false,
        error: 'Directory name must contain only lowercase letters, numbers, hyphens, and underscores',
      });
    }
    
    // Exchange session token for deploy-api scoped token via authz
    let deployToken = sessionJwt;
    
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'deploy:read'],
          purpose: 'Validate local dev directory',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: false,
        }
      );
      
      deployToken = exchangeResult.accessToken;
    } catch (exchangeError) {
      console.warn('[API/validate-local-dev] Token exchange error:', exchangeError);
      return NextResponse.json({
        valid: false,
        error: 'Failed to authenticate with deployment service. Please try logging out and back in.',
      });
    }
    
    // Call the deploy service to validate the local dev directory
    try {
      const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/validate-local-dev`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deployToken}`,
        },
        body: JSON.stringify({ dirName }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return NextResponse.json({
          valid: false,
          error: error.detail || `Failed to validate: ${response.statusText}`,
        });
      }
      
      const result = await response.json();
      
      if (!result.valid) {
        return NextResponse.json(result);
      }
      
      // Additional schema validation
      const validation = validateManifest(result.manifest);
      
      if (!validation.success) {
        return NextResponse.json({
          valid: false,
          error: (validation.errors ?? []).map((e) => `${e.path}: ${e.message}`).join('; '),
        });
      }
      
      return NextResponse.json({
        valid: true,
        manifest: result.manifest,
        dirPath: result.dirPath, // Full path in container
      });
    } catch (fetchError) {
      // If deploy service is not available, provide helpful error
      console.error('Deploy service error:', fetchError);
      return NextResponse.json({
        valid: false,
        error: 'Cannot connect to deployment service. Make sure docker services are running with "make docker-up".',
      });
    }
  } catch (error) {
    console.error('Local dev validation error:', error);
    return NextResponse.json(
      { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Failed to validate local directory' 
      },
      { status: 500 }
    );
  }
}
