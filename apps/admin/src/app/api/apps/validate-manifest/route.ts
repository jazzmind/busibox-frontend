/**
 * Validate GitHub Repository Manifest
 * POST /api/apps/validate-manifest
 * 
 * Fetches and validates busibox.json from a GitHub repository.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { fetchAndValidateManifest, isGitHubUrl } from '@jazzmind/busibox-app/lib/deploy/github-manifest';
import { validateManifest } from '@jazzmind/busibox-app/lib/deploy/manifest-schema';
import { getAppConfigById } from '@jazzmind/busibox-app/lib/deploy/app-config';

export async function POST(request: NextRequest) {
  const user = await getCurrentUserWithSessionFromCookies();
  
  if (!user || !user.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { githubUrl, githubToken, useStoredToken, appId } = body;
    
    // If useStoredToken is true, fetch token from database
    let tokenToUse = githubToken;
    if (useStoredToken && appId) {
      const app = await getAppConfigById({ userId: user.id, sessionJwt: user.sessionJwt }, appId);
      tokenToUse = app?.githubToken || undefined;
    }
    
    if (!githubUrl) {
      return NextResponse.json(
        { valid: false, error: 'GitHub URL is required' },
        { status: 400 }
      );
    }
    
    // Validate it's a GitHub URL
    if (!isGitHubUrl(githubUrl)) {
      return NextResponse.json(
        { valid: false, error: 'URL must be a GitHub repository' },
        { status: 400 }
      );
    }
    
    // Fetch and validate manifest
    const result = await fetchAndValidateManifest(githubUrl, tokenToUse);
    
    if (!result.valid) {
      return NextResponse.json(result);
    }
    
    // Additional schema validation
    const validation = validateManifest(result.manifest);
    
    if (!validation.success) {
      return NextResponse.json({
        valid: false,
        error: (validation.errors ?? []).map(e => `${e.path}: ${e.message}`).join('; '),
      });
    }
    
    return NextResponse.json({
      valid: true,
      manifest: validation.manifest,
    });
  } catch (error) {
    console.error('Manifest validation error:', error);
    return NextResponse.json(
      { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Failed to validate manifest' 
      },
      { status: 500 }
    );
  }
}
