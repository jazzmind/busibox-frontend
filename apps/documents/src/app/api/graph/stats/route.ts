/**
 * Knowledge Graph Statistics API Route
 * 
 * GET: Get graph database statistics
 * 
 * Proxies to data-api /data/graph/stats with proper authentication.
 * Returns node counts, relationship types, and availability status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:read'],
      purpose: 'graph-stats',
    });
    const dataApiToken = tokenResult.accessToken;

    const dataApiUrl = getDataApiUrl();
    const response = await fetch(`${dataApiUrl}/data/graph/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${dataApiToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API/graph/stats] Data API error:', response.status, errorText);
      return apiError('Failed to get graph stats', response.status);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('[API/graph/stats] Error:', error);
    return apiError(message, 500);
  }
}
