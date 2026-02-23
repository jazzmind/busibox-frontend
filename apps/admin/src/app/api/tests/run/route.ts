import { NextRequest, NextResponse } from 'next/server';
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
 * POST /api/tests/run
 * Proxy synchronous test execution to deploy-api.
 * (Prefer /api/tests/stream for real-time output.)
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUserWithSessionFromCookies();

  if (!user || !user.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body: TestRunRequest = await request.json();
    const { suiteId, service, makeArgs, isSecurity } = body;

    const token = await getDeployApiToken(user.id, user.sessionJwt);
    const deployApiUrl = getDeployApiUrl();

    // We re-use the SSE run endpoint and buffer its output
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
      return NextResponse.json(
        { error: 'Failed to start test run', detail: text },
        { status: upstream.status },
      );
    }

    // Buffer the stream into a full response
    const reader = upstream.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: 'No response body from deploy-api' }, { status: 500 });
    }

    const lines: string[] = [];
    let success = false;
    let exitCode = 1;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(part.slice(6));
          if (event.type === 'stdout' || event.type === 'stderr') {
            lines.push(event.data ?? '');
          }
          if (event.type === 'complete') {
            exitCode = event.exitCode ?? 1;
            success = event.success ?? false;
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    return NextResponse.json({
      suiteId,
      success,
      exitCode,
      output: lines.join(''),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[tests/run] Error running tests:', error);
    return NextResponse.json(
      { error: 'Failed to run tests', details: String(error) },
      { status: 500 },
    );
  }
}
