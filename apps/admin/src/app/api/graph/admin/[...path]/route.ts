/**
 * Graph Admin API catch-all proxy.
 *
 * Forwards all `/api/graph/admin/*` requests to `${DATA_API_URL}/data/graph/admin/*`
 * with an admin-scoped token. Admin role is enforced up front via requireAdminAuth.
 *
 * Supported methods: GET, POST, DELETE. Query strings and request bodies are
 * passed through untouched.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requireAdminAuth,
  apiError,
} from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

type RouteContext = { params: Promise<{ path: string[] }> };

const DATA_API_ADMIN_SCOPES = ['data:admin', 'data:read', 'data:write'];

async function proxy(
  request: NextRequest,
  context: RouteContext,
  method: 'GET' | 'POST' | 'DELETE',
): Promise<NextResponse> {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { user, sessionJwt } = authResult;
    const { path: segments } = await context.params;
    const subPath = (segments || []).join('/');

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: DATA_API_ADMIN_SCOPES,
      purpose: `graph-admin-${method.toLowerCase()}-${subPath || 'root'}`,
    });

    const url = new URL(request.url);
    const qs = url.search;
    const upstream = `${getDataApiUrl()}/data/graph/admin/${subPath}${qs}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokenResult.accessToken}`,
    };

    let body: string | undefined;
    if (method === 'POST' || method === 'DELETE') {
      const contentType = request.headers.get('content-type');
      if (contentType) headers['content-type'] = contentType;
      const raw = await request.text();
      body = raw.length > 0 ? raw : undefined;
    }

    const upstreamRes = await fetch(upstream, {
      method,
      headers,
      body,
    });

    const text = await upstreamRes.text();
    const responseHeaders: Record<string, string> = {};
    const ct = upstreamRes.headers.get('content-type');
    if (ct) responseHeaders['content-type'] = ct;

    return new NextResponse(text, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    console.error('[api/graph/admin] proxy error:', error);
    return apiError(message, 500);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, 'GET');
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, 'POST');
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context, 'DELETE');
}
