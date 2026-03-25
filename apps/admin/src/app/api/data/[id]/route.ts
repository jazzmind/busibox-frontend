import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin auth
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const resolvedParams = await params;
    const documentId = resolvedParams.id;

    // Exchange token for data-api access
    let tokenResult;
    try {
      tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId: user.id,
        audience: 'data-api',
      });
    } catch (exchangeError) {
      console.error('[admin/data/[id]] Token exchange failed:', exchangeError);
      return apiError('Token exchange failed', 401);
    }

    if (!tokenResult?.accessToken) {
      console.error('[admin/data/[id]] No access token received');
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();
    const authHeader = { Authorization: `Bearer ${tokenResult.accessToken}` };

    // Two parallel fetches:
    // 1) Admin endpoint (no records) — document metadata, schema, total record count
    // 2) RLS-enforced endpoint — only records the admin's roles permit
    const [adminResponse, rlsResponse] = await Promise.all([
      fetch(`${dataApiUrl}/data/admin/documents/${documentId}?includeRecords=false`, {
        headers: authHeader,
      }),
      fetch(`${dataApiUrl}/data/${documentId}?includeRecords=true`, {
        headers: authHeader,
      }),
    ]);

    if (!adminResponse.ok) {
      const errorText = await adminResponse.text();
      console.error('[admin/data/[id]] Admin endpoint error:', adminResponse.status, errorText);
      return apiError(`Failed to fetch document: ${adminResponse.status}`, adminResponse.status);
    }

    const adminData = await adminResponse.json();

    // RLS fetch may return 404 if the admin lacks the document's shared roles —
    // that's fine, we still have the admin metadata.
    let rlsRecords: unknown[] = [];
    if (rlsResponse.ok) {
      const rlsData = await rlsResponse.json();
      rlsRecords = Array.isArray(rlsData.records) ? rlsData.records : [];
    } else {
      console.log('[admin/data/[id]] RLS fetch returned', rlsResponse.status,
        '— admin lacks data-access roles for this document, records hidden');
    }

    const schema = adminData.schema || adminData.metadata?.schema;
    const totalRecordCount = adminData.recordCount ?? 0;

    const document = {
      id: adminData.id || documentId,
      documentId: adminData.id || documentId,
      name: adminData.name || adminData.metadata?.name || 'Untitled',
      displayName: schema?.displayName || adminData.metadata?.displayName || adminData.name,
      sourceApp: adminData.sourceApp || adminData.metadata?.sourceApp || 'unknown',
      itemLabel: schema?.itemLabel || adminData.metadata?.itemLabel,
      recordCount: totalRecordCount,
      visibility: adminData.visibility || 'private',
      schema: schema,
      createdAt: adminData.createdAt,
      updatedAt: adminData.updatedAt || adminData.modifiedAt,
    };

    console.log('[admin/data/[id]] Total records:', totalRecordCount,
      '| Accessible via RLS:', rlsRecords.length);

    return apiSuccess({ document, records: rlsRecords, totalRecordCount });
  } catch (error) {
    console.error('[admin/data/[id]] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}
