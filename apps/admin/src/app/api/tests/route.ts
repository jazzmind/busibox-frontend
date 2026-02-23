import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDeployApiToken } from '@jazzmind/busibox-app/lib/deploy/client';
import { getDeployApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

/**
 * GET /api/tests
 * Proxy test suite listing to deploy-api.
 *
 * deploy-api owns the authoritative list of suites and enforces the
 * environment guard (returns 403 on production).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUserWithSessionFromCookies();

  if (!user || !user.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const token = await getDeployApiToken(user.id, user.sessionJwt);
    const deployApiUrl = getDeployApiUrl();

    const upstream = await fetch(`${deployApiUrl}/api/v1/tests/suites`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      if (upstream.status === 403) {
        return NextResponse.json(
          { testSuites: [], message: 'Test runner is not available in production environments.' },
          { status: 200 },
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch test suites', detail: text },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[tests/route] Error fetching test suites:', error);
    return NextResponse.json(
      { error: 'Failed to connect to deploy-api', detail: String(error) },
      { status: 500 },
    );
  }
}
