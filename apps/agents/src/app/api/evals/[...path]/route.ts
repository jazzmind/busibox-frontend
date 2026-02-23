/**
 * Catch-all proxy for the Agent API's /evals/* endpoints.
 *
 * Forwards GET, POST, PATCH, DELETE requests to the backend agent-api,
 * attaching a properly exchanged agent-api-scoped token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentApiUrl, getAgentApiHeaders } from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
  method: string,
): Promise<NextResponse> {
  const { path } = await params;
  const targetPath = path.join('/');
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();

  const backendUrl = `${getAgentApiUrl()}/evals/${targetPath}${queryString ? `?${queryString}` : ''}`;

  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) return auth;

    const headers = getAgentApiHeaders(auth.apiToken);

    let body: BodyInit | undefined;
    if (['POST', 'PATCH', 'PUT'].includes(method)) {
      const text = await request.text();
      body = text || undefined;
    }

    const response = await fetch(backendUrl, { method, headers, body });

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error(`[API] Eval proxy ${method} /evals/${targetPath} failed:`, error);
    return NextResponse.json(
      { error: error.message || 'Eval API request failed' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, 'GET');
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, 'POST');
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, 'PATCH');
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, 'DELETE');
}
