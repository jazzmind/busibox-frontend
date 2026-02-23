import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;

    const { fileId } = await params;
    const schemaDocumentId = request.nextUrl.searchParams.get('schemaDocumentId');
    if (!schemaDocumentId) {
      return apiError('schemaDocumentId is required', 400);
    }

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data.read'],
      purpose: 'document-extractions-query',
    });

    const dataApiUrl = getDataApiUrl();
    const queryResponse = await fetch(`${dataApiUrl}/data/${schemaDocumentId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        where: {
          field: '_sourceFileId',
          op: 'eq',
          value: fileId,
        },
        orderBy: [{ field: '_extractedAt', direction: 'desc' }],
        limit: 50,
        offset: 0,
      }),
    });

    const text = await queryResponse.text();
    return new NextResponse(text, {
      status: queryResponse.status,
      headers: {
        'Content-Type': queryResponse.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error: any) {
    return apiError(error.message || 'Failed to fetch extraction records', 500);
  }
}
