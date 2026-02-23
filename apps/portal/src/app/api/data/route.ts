/**
 * Data Documents API Route
 *
 * GET: List data documents
 * POST: Create data document
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

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

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user, sessionJwt } = authResult;
    const dataApiToken = await getDataApiToken(sessionJwt, user.id, ['data.read'], 'data-list');
    const dataApiUrl = getDataApiUrl();
    const targetUrl = new URL(`${dataApiUrl}/data`);
    request.nextUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${dataApiToken}` },
    });

    const bodyText = await response.text();
    return new NextResponse(bodyText, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
    });
  } catch (error: any) {
    return apiError(error.message || 'Failed to list data documents', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user, sessionJwt } = authResult;
    const dataApiToken = await getDataApiToken(sessionJwt, user.id, ['data.write'], 'data-create');
    const body = await request.json();
    const dataApiUrl = getDataApiUrl();
    const response = await fetch(`${dataApiUrl}/data`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${dataApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const bodyText = await response.text();
    return new NextResponse(bodyText, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
    });
  } catch (error: any) {
    return apiError(error.message || 'Failed to create data document', 500);
  }
}
