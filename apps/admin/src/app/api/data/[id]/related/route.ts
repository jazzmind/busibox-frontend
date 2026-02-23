import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

/**
 * Query related records from a target document.
 * 
 * GET /api/data/{docId}/related?document={targetDocName}&foreignKey={key}&value={recordId}
 * 
 * This endpoint supports navigating relations between data documents.
 * For example, when viewing a project, you can fetch its related tasks:
 *   GET /api/data/{projectDocId}/related?document=busibox-projects-tasks&foreignKey=projectId&value={projectId}
 */
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
    const sourceDocumentId = resolvedParams.id;

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const targetDocumentName = searchParams.get('document');
    const foreignKey = searchParams.get('foreignKey');
    const value = searchParams.get('value');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!targetDocumentName) {
      return apiError('Missing required parameter: document', 400);
    }

    if (!foreignKey) {
      return apiError('Missing required parameter: foreignKey', 400);
    }

    if (!value) {
      return apiError('Missing required parameter: value', 400);
    }

    // Exchange token for data-api access
    let tokenResult;
    try {
      tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId: user.id,
        audience: 'data-api',
      });
    } catch (exchangeError) {
      console.error('[admin/data/[id]/related] Token exchange failed:', exchangeError);
      return apiError('Token exchange failed', 401);
    }

    if (!tokenResult?.accessToken) {
      console.error('[admin/data/[id]/related] No access token received');
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();

    // First, find the target document by name
    const listResponse = await fetch(`${dataApiUrl}/data`, {
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('[admin/data/[id]/related] Failed to list documents:', listResponse.status, errorText);
      return apiError(`Failed to list documents: ${listResponse.status}`, listResponse.status);
    }

    const listData = await listResponse.json();
    const documents = listData.documents || [];
    
    const targetDocument = documents.find((d: { name: string }) => d.name === targetDocumentName);
    if (!targetDocument) {
      return apiError(`Document not found: ${targetDocumentName}`, 404);
    }

    // Query the target document for records matching the foreign key
    const queryResponse = await fetch(`${dataApiUrl}/data/${targetDocument.id}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        where: {
          field: foreignKey,
          op: 'eq',
          value: value,
        },
        limit,
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
      }),
    });

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      console.error('[admin/data/[id]/related] Query failed:', queryResponse.status, errorText);
      return apiError(`Failed to query related records: ${queryResponse.status}`, queryResponse.status);
    }

    const queryData = await queryResponse.json();
    const records = queryData.records || [];
    const total = queryData.total || records.length;

    // Also fetch the target document's schema for display purposes
    const docResponse = await fetch(`${dataApiUrl}/data/${targetDocument.id}?includeRecords=false`, {
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
      },
    });

    let schema = null;
    if (docResponse.ok) {
      const docData = await docResponse.json();
      schema = docData.schema || docData.metadata?.schema || null;
    }

    return apiSuccess({
      sourceDocumentId,
      targetDocument: {
        id: targetDocument.id,
        name: targetDocument.name,
        displayName: schema?.displayName || targetDocument.name,
        itemLabel: schema?.itemLabel,
        schema,
      },
      foreignKey,
      value,
      records,
      total,
    });
  } catch (error) {
    console.error('[admin/data/[id]/related] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}
