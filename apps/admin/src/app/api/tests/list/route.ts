import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDeployApiToken } from '@jazzmind/busibox-app/lib/deploy/client';
import { getDeployApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

/**
 * GET /api/tests/list?service=agent&category=unit&detail=full
 * Proxy test file listing to deploy-api.
 *
 * deploy-api calls list-tests.sh to discover test files/IDs.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUserWithSessionFromCookies();

  if (!user || !user.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const service = searchParams.get('service');
  const category = searchParams.get('category');
  const detail = searchParams.get('detail');

  if (!service) {
    return NextResponse.json({ error: 'service query param is required' }, { status: 400 });
  }

  try {
    const token = await getDeployApiToken(user.id, user.sessionJwt);
    const deployApiUrl = getDeployApiUrl();

    const url = new URL(`${deployApiUrl}/api/v1/tests/list`);
    url.searchParams.set('service', service);
    if (category) url.searchParams.set('category', category);
    if (detail) url.searchParams.set('detail', detail);

    const upstream = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return NextResponse.json(
        { error: 'Failed to list test files', detail: text },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[tests/list] Error listing test files:', error);
    return NextResponse.json(
      { error: 'Failed to connect to deploy-api', detail: String(error) },
      { status: 500 },
    );
  }
}
