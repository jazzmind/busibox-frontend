import { NextRequest, NextResponse } from 'next/server';

import { sanitizeAppName } from '@jazzmind/busibox-app/lib/authz';

function getAuthzBaseUrl(): string {
  return process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';
}

export async function GET(request: NextRequest) {
  try {
    const appName = sanitizeAppName(process.env.APP_NAME || 'busibox-agents');
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const sessionJwt =
      request.cookies.get('busibox-session')?.value ||
      request.cookies.get(`${appName}-auth-token`)?.value ||
      headerToken;
    if (!sessionJwt) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const response = await fetch(`${getAuthzBaseUrl()}/me/channel-bindings`, {
      headers: {
        Authorization: `Bearer ${sessionJwt}`,
      },
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        {
          error: data.detail || data.error || 'Failed to fetch channel bindings',
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      bindings: Array.isArray(data.bindings) ? data.bindings : [],
    });
  } catch (error) {
    console.error('Failed to fetch channel bindings:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 },
    );
  }
}
