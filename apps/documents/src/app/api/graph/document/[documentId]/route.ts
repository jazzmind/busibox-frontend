/**
 * Graph Document Context API Route
 * 
 * GET: Get graph data for a specific document
 * 
 * Proxies to data-api /data/graph/document/{document_id} with proper authentication.
 * Supports query parameters: depth, limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';

interface RouteParams {
  params: Promise<{ documentId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data.read'],
      purpose: 'graph-document',
    });
    const dataApiToken = tokenResult.accessToken;

    // Forward query params
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const dataApiUrl = getDataApiUrl();
    const url = `${dataApiUrl}/data/graph/document/${encodeURIComponent(documentId)}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${dataApiToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API/graph/document] Data API error:', response.status, errorText);
      return apiError('Failed to get document graph data', response.status);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('[API/graph/document] Error:', error);
    return apiError(message, 500);
  }
}
