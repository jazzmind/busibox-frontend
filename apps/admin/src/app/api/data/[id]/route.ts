import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';
import { resolveAppResourceId } from '../../../../lib/app-lookup';

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
    const resolvedParams = await params;
    const documentId = resolvedParams.id;

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
    const adminAuthHeader = { Authorization: `Bearer ${tokenResult.accessToken}` };

    // Step 1: Fetch admin metadata (bypasses RLS)
    const adminResponse = await fetch(
      `${dataApiUrl}/data/admin/documents/${documentId}?includeRecords=false`,
      { headers: adminAuthHeader },
    );

    if (!adminResponse.ok) {
      const errorText = await adminResponse.text();
      console.error('[admin/data/[id]] Admin endpoint error:', adminResponse.status, errorText);
      return apiError(`Failed to fetch document: ${adminResponse.status}`, adminResponse.status);
    }

    const adminData = await adminResponse.json();
    const sourceApp = adminData.sourceApp || adminData.metadata?.sourceApp;

    // Step 2: If the document belongs to an app, get an app-scoped token
    let rlsToken = tokenResult.accessToken;
    if (sourceApp && sourceApp !== 'unknown') {
      const appResourceId = await resolveAppResourceId(sessionJwt, sourceApp);
      if (appResourceId) {
        try {
          const appTokenResult = await exchangeWithSubjectToken({
            sessionJwt,
            audience: 'data-api',
            resourceId: appResourceId,
            purpose: `admin-app-access:${sourceApp}`,
          });
          if (appTokenResult?.accessToken) {
            rlsToken = appTokenResult.accessToken;
          }
        } catch (appExchangeError) {
          console.log('[admin/data/[id]] App-scoped token exchange failed (admin may lack app access):', appExchangeError);
        }
      } else {
        console.log('[admin/data/[id]] Could not resolve app resource ID for:', sourceApp);
      }
    }

    // Step 3: Fetch RLS-filtered records using the (possibly app-scoped) token
    let rlsRecords: unknown[] = [];
    const rlsResponse = await fetch(
      `${dataApiUrl}/data/${documentId}?includeRecords=true`,
      { headers: { Authorization: `Bearer ${rlsToken}` } },
    );

    if (rlsResponse.ok) {
      const rlsData = await rlsResponse.json();
      rlsRecords = Array.isArray(rlsData.records) ? rlsData.records : [];
    } else {
      console.log('[admin/data/[id]] RLS fetch returned', rlsResponse.status,
        '— admin lacks data-access roles for this document, records hidden');
    }

    const schema = adminData.schema || adminData.metadata?.schema;
    const totalRecordCount = adminData.recordCount ?? 0;

    // Build set of accessible record IDs for the UI
    const accessibleRecordIds = rlsRecords
      .map((r) => (r as { id?: string }).id)
      .filter(Boolean);

    const document = {
      id: adminData.id || documentId,
      documentId: adminData.id || documentId,
      name: adminData.name || adminData.metadata?.name || 'Untitled',
      displayName: schema?.displayName || adminData.metadata?.displayName || adminData.name,
      sourceApp: sourceApp || 'unknown',
      itemLabel: schema?.itemLabel || adminData.metadata?.itemLabel,
      recordCount: totalRecordCount,
      visibility: adminData.visibility || 'private',
      schema: schema,
      createdAt: adminData.createdAt,
      updatedAt: adminData.updatedAt || adminData.modifiedAt,
    };

    console.log('[admin/data/[id]] Total records:', totalRecordCount,
      '| Accessible via RLS:', rlsRecords.length);

    return apiSuccess({ document, records: rlsRecords, totalRecordCount, accessibleRecordIds });
  } catch (error) {
    console.error('[admin/data/[id]] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}
