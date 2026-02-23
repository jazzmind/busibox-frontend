import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type ImportBody = {
  records?: unknown[];
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id: documentId } = await params;
    const body = (await request.json()) as ImportBody | unknown[];

    const incomingRecords: unknown[] = Array.isArray(body)
      ? body
      : Array.isArray((body as ImportBody).records)
        ? (body as ImportBody).records as unknown[]
        : [];

    if (incomingRecords.length === 0) {
      return apiError('Import payload must include a non-empty records array', 400);
    }

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
    });

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();
    const importResponse = await fetch(`${dataApiUrl}/data/${documentId}/records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: incomingRecords,
        validate: true,
      }),
    });

    if (!importResponse.ok) {
      const errorText = await importResponse.text();
      console.error('[admin/data/[id]/import] Failed to import records:', importResponse.status, errorText);
      return apiError(`Failed to import records: ${errorText || importResponse.status}`, importResponse.status);
    }

    const importResult = await importResponse.json();
    return apiSuccess({
      imported: importResult.count ?? incomingRecords.length,
      recordIds: importResult.recordIds ?? [],
    });
  } catch (error) {
    console.error('[admin/data/[id]/import] Error:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
