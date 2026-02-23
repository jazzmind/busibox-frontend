/**
 * App Secrets Management
 * GET /api/deployments/secrets?configId=xxx - List secrets for config
 * POST /api/deployments/secrets - Create/update secret
 * Proxies to deploy-api.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDeployApiToken, listSecrets, upsertSecret } from '@jazzmind/busibox-app/lib/deploy/client';

export async function GET(request: NextRequest) {
  const result = await getCurrentUserWithSessionFromCookies();

  if (!result || !result.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const configId = request.nextUrl.searchParams.get('configId');

  if (!configId) {
    return NextResponse.json({ error: 'Missing configId' }, { status: 400 });
  }

  try {
    const token = await getDeployApiToken(result.id, result.sessionJwt);
    const data = await listSecrets(token, configId);
    return NextResponse.json({ secrets: data.secrets });
  } catch (error) {
    console.error('Failed to fetch secrets:', error);
    return NextResponse.json({ error: 'Failed to fetch secrets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { configId, key, value, type, description } = body;

    if (!configId || !key || !value || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const token = await getDeployApiToken(auth.user.id, auth.sessionJwt);
    const data = await upsertSecret(token, configId, {
      key,
      value,
      type,
      description,
    });
    return NextResponse.json({ secret: data.secret }, { status: 201 });
  } catch (error) {
    console.error('Failed to save secret:', error);
    return NextResponse.json({ error: 'Failed to save secret' }, { status: 500 });
  }
}
