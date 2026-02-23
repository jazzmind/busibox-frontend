import { NextRequest } from 'next/server';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDeployApiToken } from '@jazzmind/busibox-app/lib/deploy/client';
import { getDeployApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export const maxDuration = 300; // 5 minutes

interface TestRunRequest {
  suiteId: string;
  service: string;
  makeArgs: string;
  isSecurity?: boolean;
}

/**
 * POST /api/tests/stream
 * Proxy test execution SSE stream from deploy-api.
 *
 * Previously this spawned `make test-docker` directly via child_process, which
 * failed because the portal runs in core-apps (no Docker socket, no busibox repo).
 * Now we forward to deploy-api which has both.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUserWithSessionFromCookies();

  if (!user || !user.roles?.includes('Admin')) {
    return new Response('Unauthorized', { status: 403 });
  }

  try {
    const body: TestRunRequest = await request.json();
    const { suiteId, service, makeArgs, isSecurity } = body;

    const token = await getDeployApiToken(user.id, user.sessionJwt);
    const deployApiUrl = getDeployApiUrl();

    const upstream = await fetch(`${deployApiUrl}/api/v1/tests/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ suiteId, service, makeArgs, isSecurity: isSecurity ?? false }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: 'Failed to start test run', detail: text }),
        { status: upstream.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Pass through the SSE stream from deploy-api to the browser
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[tests/stream] Error proxying test stream:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to connect to deploy-api', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
