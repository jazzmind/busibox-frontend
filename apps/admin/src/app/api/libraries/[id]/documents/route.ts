/**
 * Admin Library Documents API Route
 *
 * GET: List files inside a library (proxies to data-api /libraries/{id}/documents)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  exchangeWithSubjectToken,
  getUserIdFromSessionJwt,
} from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Invalid session', 401);

    const { id } = await params;
    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId,
      audience: 'data-api',
      scopes: ['data:read'],
      purpose: 'admin-library-documents',
    });

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();

    const response = await fetch(
      `${dataApiUrl}/libraries/${id}/documents${qs ? `?${qs}` : ''}`,
      {
        headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin/libraries/documents] Data API error:', response.status, errorText);
      return apiError(`Failed to fetch library documents: ${response.status}`, response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[admin/libraries/documents] Error:', error);
    return apiError('Internal server error', 500);
  }
}
