/**
 * GitHub OAuth Connection - Initiate OAuth flow
 * GET /api/github/connect
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';

export async function GET() {
  const user = await getCurrentUserFromCookies();
  
  if (!user || !user.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const clientId = process.env.GITHUB_CLIENT_ID;
  // APP_URL is runtime-only (server-side), NEXT_PUBLIC_APP_URL is baked at build time
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const redirectUri = process.env.GITHUB_REDIRECT_URI || `${appUrl}/api/github/callback`;
  
  if (!clientId) {
    return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 500 });
  }
  
  // Request scopes for private repository access and package registry
  // read:packages is required to download packages from GitHub Package Registry
  const scopes = ['repo', 'read:user', 'user:email', 'read:packages'];
  const state = crypto.randomUUID(); // TODO: Store state in session for validation
  
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('state', state);
  
  return NextResponse.json({ authUrl: authUrl.toString(), state });
}

