/**
 * Data Document Query API Route
 * 
 * POST: Query records from a data document
 * 
 * Proxies to data-api with proper authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ documentId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;
    
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const body = await request.json();
    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data.read'],
      purpose: 'data-query',
    });
    const dataApiUrl = getDataApiUrl();
    const response = await fetch(`${dataApiUrl}/data/${documentId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API/data/query] Data API error:', response.status, errorText);
      return apiError('Failed to query data', response.status);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API/data/query] Error:', error);
    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}
