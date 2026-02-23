import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string; recordId: string }>;
}

/**
 * GET /api/data/{docId}/record/{recordId}
 * Fetch a single record from a data document.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id: documentId, recordId } = await params;

    // Exchange token for data-api access
    let tokenResult;
    try {
      tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId: user.id,
        audience: 'data-api',
      });
    } catch (exchangeError) {
      console.error('[admin/data/[id]/record/[recordId]] Token exchange failed:', exchangeError);
      return apiError('Token exchange failed', 401);
    }

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();

    // Query for the specific record by ID
    const queryResponse = await fetch(`${dataApiUrl}/data/${documentId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        where: {
          field: 'id',
          op: 'eq',
          value: recordId,
        },
        limit: 1,
      }),
    });

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      console.error('[admin/data/[id]/record/[recordId]] Query failed:', queryResponse.status, errorText);
      return apiError(`Failed to fetch record: ${queryResponse.status}`, queryResponse.status);
    }

    const queryData = await queryResponse.json();
    const records = queryData.records || [];

    if (records.length === 0) {
      return apiError('Record not found', 404);
    }

    const record = records[0];

    // Also get document info for context
    const docResponse = await fetch(`${dataApiUrl}/data/${documentId}?includeRecords=false`, {
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
      },
    });

    let document = null;
    if (docResponse.ok) {
      const docData = await docResponse.json();
      // Schema can be at top level or in metadata
      const schema = docData.schema || docData.metadata?.schema;
      document = {
        id: docData.id || documentId,
        name: docData.name,
        displayName: schema?.displayName || docData.metadata?.displayName || docData.name,
        sourceApp: docData.sourceApp || docData.metadata?.sourceApp,
        itemLabel: schema?.itemLabel || docData.metadata?.itemLabel,
        schema: schema,
      };
      
      console.log('[admin/data/[id]/record/[recordId]] Document schema:', 
        schema ? `has ${Object.keys(schema.relations || {}).length} relations` : 'no schema');
    }

    return apiSuccess({ record, document });
  } catch (error) {
    console.error('[admin/data/[id]/record/[recordId]] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}

/**
 * PUT /api/data/{docId}/record/{recordId}
 * Update a single record in a data document.
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id: documentId, recordId } = await params;
    const body = await request.json();

    // Exchange token for data-api access
    let tokenResult;
    try {
      tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId: user.id,
        audience: 'data-api',
      });
    } catch (exchangeError) {
      console.error('[admin/data/[id]/record/[recordId]] Token exchange failed:', exchangeError);
      return apiError('Token exchange failed', 401);
    }

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();

    // Update the record using the update endpoint
    const updateResponse = await fetch(`${dataApiUrl}/data/${documentId}/records`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        updates: body.updates || body,
        where: {
          field: 'id',
          op: 'eq',
          value: recordId,
        },
        validate: body.validate !== false,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('[admin/data/[id]/record/[recordId]] Update failed:', updateResponse.status, errorText);
      return apiError(`Failed to update record: ${updateResponse.status}`, updateResponse.status);
    }

    const updateData = await updateResponse.json();

    return apiSuccess({
      success: true,
      count: updateData.count || 1,
      message: 'Record updated successfully',
    });
  } catch (error) {
    console.error('[admin/data/[id]/record/[recordId]] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}

/**
 * DELETE /api/data/{docId}/record/{recordId}
 * Delete a single record from a data document.
 * 
 * Query params:
 * - cascade: If true, also delete related records in child documents
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id: documentId, recordId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const cascade = searchParams.get('cascade') === 'true';

    // Exchange token for data-api access
    let tokenResult;
    try {
      tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId: user.id,
        audience: 'data-api',
      });
    } catch (exchangeError) {
      console.error('[admin/data/[id]/record/[recordId]] Token exchange failed:', exchangeError);
      return apiError('Token exchange failed', 401);
    }

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();
    const deletedRecords: { document: string; count: number }[] = [];

    // If cascade is enabled, we need to find and delete related records first
    if (cascade) {
      // Get document schema to find hasMany relations
      const docResponse = await fetch(`${dataApiUrl}/data/${documentId}?includeRecords=false`, {
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
        },
      });

      if (docResponse.ok) {
        const docData = await docResponse.json();
        const schema = docData.schema || docData.metadata?.schema;
        const relations = schema?.relations || {};

        // Find hasMany relations
        for (const [, relation] of Object.entries(relations)) {
          const rel = relation as { type: string; document: string; foreignKey: string };
          if (rel.type === 'hasMany') {
            // Find the target document ID by name
            const listResponse = await fetch(`${dataApiUrl}/data`, {
              headers: {
                'Authorization': `Bearer ${tokenResult.accessToken}`,
              },
            });

            if (listResponse.ok) {
              const listData = await listResponse.json();
              const targetDoc = (listData.documents || []).find(
                (d: { name: string }) => d.name === rel.document
              );

              if (targetDoc) {
                // Delete related records
                const deleteRelatedResponse = await fetch(`${dataApiUrl}/data/${targetDoc.id}/records`, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${tokenResult.accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    where: {
                      field: rel.foreignKey,
                      op: 'eq',
                      value: recordId,
                    },
                  }),
                });

                if (deleteRelatedResponse.ok) {
                  const deleteRelatedData = await deleteRelatedResponse.json();
                  if (deleteRelatedData.count > 0) {
                    deletedRecords.push({
                      document: rel.document,
                      count: deleteRelatedData.count,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Delete the main record
    const deleteResponse = await fetch(`${dataApiUrl}/data/${documentId}/records`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recordIds: [recordId],
      }),
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('[admin/data/[id]/record/[recordId]] Delete failed:', deleteResponse.status, errorText);
      return apiError(`Failed to delete record: ${deleteResponse.status}`, deleteResponse.status);
    }

    const deleteData = await deleteResponse.json();

    return apiSuccess({
      success: true,
      count: deleteData.count || 1,
      message: cascade && deletedRecords.length > 0
        ? `Record deleted along with ${deletedRecords.reduce((sum, r) => sum + r.count, 0)} related records`
        : 'Record deleted successfully',
      cascadeDeleted: cascade ? deletedRecords : undefined,
    });
  } catch (error) {
    console.error('[admin/data/[id]/record/[recordId]] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}
