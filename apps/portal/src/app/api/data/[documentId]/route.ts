/**
 * Single Data Document API Route
 *
 * GET: Fetch a data document
 * PUT: Update a data document
 * DELETE: Delete a data document
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ documentId: string }>;
}

async function getDataApiToken(
  sessionJwt: string,
  userId: string,
  scopes: string[],
  purpose: string
): Promise<string> {
  const result = await exchangeWithSubjectToken({
    sessionJwt,
    userId,
    audience: 'data-api',
    scopes,
    purpose,
  });
  return result.accessToken;
}

async function forward(
  request: NextRequest,
  method: 'GET' | 'PUT' | 'DELETE',
  documentId: string
): Promise<Response> {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const { user, sessionJwt } = authResult;
  const scopes = method === 'GET' ? ['data.read'] : method === 'DELETE' ? ['data.delete'] : ['data.write'];
  const dataApiToken = await getDataApiToken(sessionJwt, user.id, scopes, `data-document-${method.toLowerCase()}`);
  const dataApiUrl = getDataApiUrl();
  const url = new URL(`${dataApiUrl}/data/${documentId}`);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${dataApiToken}`,
  };
  let body: string | undefined = undefined;
  if (method === 'PUT') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(await request.json());
  }
  const response = await fetch(url.toString(), { method, headers, body });

  // 204 No Content — return empty success JSON so the frontend doesn't choke
  if (response.status === 204) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  const bodyText = await response.text();
  return new NextResponse(bodyText, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
  });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;
    return await forward(request, 'GET', documentId);
  } catch (error: any) {
    return apiError(error.message || 'Failed to fetch data document', 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;
    return await forward(request, 'PUT', documentId);
  } catch (error: any) {
    return apiError(error.message || 'Failed to update data document', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;
    return await forward(request, 'DELETE', documentId);
  } catch (error: any) {
    return apiError(error.message || 'Failed to delete data document', 500);
  }
}
