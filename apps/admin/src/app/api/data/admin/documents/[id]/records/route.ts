import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id: documentId } = await params;

    let tokenResult;
    try {
      tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId: user.id,
        audience: 'data-api',
      });
    } catch (exchangeError) {
      console.error('[admin/data/admin/documents/records] Token exchange failed:', exchangeError);
      return apiError('Token exchange failed', 401);
    }

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '200';
    const offset = url.searchParams.get('offset') || '0';

    const response = await fetch(
      `${dataApiUrl}/data/admin/documents/${documentId}/records?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin/data/admin/documents/records] Data API error:', response.status, errorText);
      return apiError(`Failed to list records: ${response.status}`, response.status);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[admin/data/admin/documents/records] Error:', error);
    return apiError('Internal server error', 500);
  }
}
