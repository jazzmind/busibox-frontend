/**
 * GitHub Connection Status
 * GET /api/github/status
 * 
 * Proxies to deploy-api to check GitHub connection status.
 */

import { NextResponse } from 'next/server';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDeployApiToken, getGitHubStatus } from '@jazzmind/busibox-app/lib/deploy/client';

export async function GET() {
  const user = await getCurrentUserWithSessionFromCookies();
  
  if (!user || !user.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const token = await getDeployApiToken(user.id, user.sessionJwt);
    const status = await getGitHubStatus(token);
    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to check GitHub connection status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
