import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const QUERY_PAGE_SIZE = 1000;

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id: documentId } = await params;

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
    });

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();

    const documentResponse = await fetch(`${dataApiUrl}/data/${documentId}?includeRecords=false`, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!documentResponse.ok) {
      const errorText = await documentResponse.text();
      console.error('[admin/data/[id]/export] Failed to fetch document:', documentResponse.status, errorText);
      return apiError(`Failed to fetch document: ${documentResponse.status}`, documentResponse.status);
    }

    const documentData = await documentResponse.json();
    const allRecords: unknown[] = [];
    let offset = 0;

    while (true) {
      const queryResponse = await fetch(`${dataApiUrl}/data/${documentId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: QUERY_PAGE_SIZE,
          offset,
        }),
      });

      if (!queryResponse.ok) {
        const errorText = await queryResponse.text();
        console.error('[admin/data/[id]/export] Failed to query records:', queryResponse.status, errorText);
        return apiError(`Failed to query records: ${queryResponse.status}`, queryResponse.status);
      }

      const queryData = await queryResponse.json();
      const records = Array.isArray(queryData.records) ? queryData.records : [];
      allRecords.push(...records);

      if (records.length < QUERY_PAGE_SIZE) {
        break;
      }
      offset += QUERY_PAGE_SIZE;
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      document: {
        id: documentData.id ?? documentId,
        name: documentData.name,
        sourceApp: documentData.sourceApp,
        visibility: documentData.visibility,
        schema: documentData.schema ?? documentData.metadata?.schema ?? null,
      },
      recordCount: allRecords.length,
      records: allRecords,
    };

    const filenameBase = (documentData.name || `document-${documentId}`).replace(/[^a-zA-Z0-9-_]/g, '-');

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filenameBase}-export.json"`,
      },
    });
  } catch (error) {
    console.error('[admin/data/[id]/export] Error:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
