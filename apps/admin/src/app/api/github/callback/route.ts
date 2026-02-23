/**
 * GitHub OAuth Callback
 * GET /api/github/callback?code=xxx&state=xxx
 * 
 * Proxies the OAuth code to deploy-api for token exchange and storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDeployApiToken, submitGitHubCallback } from '@jazzmind/busibox-app/lib/deploy/client';

export async function GET(request: NextRequest) {
  const user = await getCurrentUserWithSessionFromCookies();
  
  if (!user || !user.roles?.includes('Admin')) {
    return NextResponse.redirect(new URL('/portal/login', request.url));
  }
  
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  if (!code) {
    return NextResponse.redirect(new URL('/apps?error=no_code', request.url));
  }
  
  try {
    const token = await getDeployApiToken(user.id, user.sessionJwt);
    await submitGitHubCallback(token, code, state || undefined);
    
    console.log('[GitHub Callback] Connection saved via deploy-api');
    return NextResponse.redirect(new URL('/apps?github_connected=true', request.url));
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/apps?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, request.url)
    );
  }
}
