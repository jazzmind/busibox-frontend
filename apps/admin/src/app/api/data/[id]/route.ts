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

    // Fetch the document with its data
    const response = await fetch(`${dataApiUrl}/data/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin/data/[id]] Data API error:', response.status, errorText);
      return apiError(`Failed to fetch document: ${response.status}`, response.status);
    }

    const data = await response.json();
    
    console.log('[admin/data/[id]] Raw data-api response:', JSON.stringify(data).slice(0, 1000));
    
    // The data-api returns the document with `records` field (not `content`)
    const recordsArray = Array.isArray(data.records) ? data.records : [];
    
    // Schema can be at top level or in metadata
    const schema = data.schema || data.metadata?.schema;
    
    console.log('[admin/data/[id]] Records found:', recordsArray.length, 'items');
    console.log('[admin/data/[id]] Schema:', 
      schema ? `has ${Object.keys(schema.fields || {}).length} fields, ${Object.keys(schema.relations || {}).length} relations` : 'no schema');
    
    // Extract metadata and document info
    // Note: data-api uses camelCase (sourceApp, recordCount, createdAt)
    const document = {
      id: data.id || documentId,
      documentId: data.id || documentId,
      name: data.name || data.metadata?.name || 'Untitled',
      displayName: schema?.displayName || data.metadata?.displayName || data.name,
      sourceApp: data.sourceApp || data.metadata?.sourceApp || 'unknown',
      itemLabel: schema?.itemLabel || data.metadata?.itemLabel,
      recordCount: data.recordCount || recordsArray.length,
      visibility: data.visibility || 'private',
      schema: schema,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt || data.modifiedAt,
    };

    const records = recordsArray;

    return apiSuccess({ document, records });
  } catch (error) {
    console.error('[admin/data/[id]] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}
