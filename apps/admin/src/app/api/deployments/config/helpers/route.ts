/**
 * Deployment Configuration Helpers
 * GET /api/deployments/config/helpers - Get next available port and validate paths
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { findAppConfigByPath } from '@jazzmind/busibox-app/lib/deploy/app-config';
import { getDeployApiToken, getNextPort } from '@jazzmind/busibox-app/lib/deploy/client';

// Reserved Busibox Portal paths that cannot be used by other apps
const RESERVED_PATHS = [
  '/',
  '/home',
  '/portal',
  '/login',
  '/api',
  '/admin',
  '/videos',
  '/auth',
  '/sso',
  '/callback',
];

/**
 * Get next available port and validate paths
 * Query params:
 * - action: 'next-port' | 'validate-path'
 * - path: string (for validate-path)
 * - repoName: string (for generate-path)
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUserWithSessionFromCookies();
  
  if (!user || !user.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  
  try {
    if (action === 'next-port') {
      const token = await getDeployApiToken(user.id, user.sessionJwt);
      const result = await getNextPort(token);
      return NextResponse.json({ port: result.port });
    }
    
    if (action === 'validate-path') {
      const path = searchParams.get('path');
      
      if (!path) {
        return NextResponse.json(
          { error: 'Path parameter required' },
          { status: 400 }
        );
      }
      
      // Check if path is reserved
      const normalizedPath = path.toLowerCase().trim();
      
      // Check for exact matches or paths that start with reserved + '/'
      const isReserved = RESERVED_PATHS.some(reserved => {
        // Exact match
        if (normalizedPath === reserved) return true;
        // Starts with reserved path + slash (e.g., /api/something)
        if (normalizedPath.startsWith(reserved + '/')) return true;
        return false;
      });
      
      if (isReserved) {
        return NextResponse.json({
          valid: false,
          error: `Path '${path}' conflicts with Busibox Portal reserved paths`,
        });
      }
      
      // Check if path is already in use by another app
      const existingApp = await findAppConfigByPath(
        { userId: user.id, sessionJwt: user.sessionJwt },
        path
      );
      
      if (existingApp) {
        return NextResponse.json({
          valid: false,
          error: `Path '${path}' is already used by ${existingApp.name}`,
        });
      }
      
      // Path validation: must start with / and contain only valid characters
      if (!/^\/[a-z0-9-_]+$/.test(path)) {
        return NextResponse.json({
          valid: false,
          error: 'Path must start with / and contain only lowercase letters, numbers, hyphens, and underscores',
        });
      }
      
      return NextResponse.json({ valid: true });
    }
    
    if (action === 'generate-path') {
      const repoName = searchParams.get('repoName');
      
      if (!repoName) {
        return NextResponse.json(
          { error: 'repoName parameter required' },
          { status: 400 }
        );
      }
      
      // Generate path from repo name: convert to kebab-case and add leading /
      const path = '/' + repoName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      const deployPath = `/srv/apps/${repoName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')}`;
      
      return NextResponse.json({ path, deployPath });
    }
    
    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Deployment config helpers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
