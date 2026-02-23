/**
 * Data Document Records API Route
 * 
 * PUT: Update records in a data document
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

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
      scopes: ['data.write'],
      purpose: 'data-record-update',
    });
    const dataApiUrl = getDataApiUrl();
    const response = await fetch(`${dataApiUrl}/data/${documentId}/records`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API/data/records] Data API error:', response.status, errorText);
      return apiError('Failed to update records', response.status);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API/data/records] Error:', error);
    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
      scopes: ['data.write'],
      purpose: 'data-record-delete',
    });
    const dataApiUrl = getDataApiUrl();
    const response = await fetch(`${dataApiUrl}/data/${documentId}/records`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API/data/records DELETE] Data API error:', response.status, errorText);
      return apiError('Failed to delete records', response.status);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API/data/records DELETE] Error:', error);
    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}
