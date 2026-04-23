import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;

    let tokenResult;
    try {
      tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId: user.id,
        audience: 'data-api',
      });
    } catch (exchangeError) {
      console.error('[admin/data/admin/files] Token exchange failed:', exchangeError);
      return apiError('Token exchange failed', 401);
    }

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();

    const response = await fetch(
      `${dataApiUrl}/files/admin/list${qs ? `?${qs}` : ''}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin/data/admin/files] Data API error:', response.status, errorText);
      return apiError(`Failed to fetch admin files: ${response.status}`, response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[admin/data/admin/files] Error:', error);
    return apiError('Internal server error', 500);
  }
}
