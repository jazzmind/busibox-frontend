import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/data/{docId}/delete
 * Delete an entire data document.
 * 
 * Query params:
 * - cascade: If true, also delete related records in child documents first
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
    const { id: documentId } = await params;
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
      console.error('[admin/data/[id]/delete] Token exchange failed:', exchangeError);
      return apiError('Token exchange failed', 401);
    }

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();
    const deletedRelated: { document: string; count: number }[] = [];

    // If cascade is enabled, we need to find and delete related records first
    if (cascade) {
      // Get document with records to find all record IDs
      const docResponse = await fetch(`${dataApiUrl}/data/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
        },
      });

      if (docResponse.ok) {
        const docData = await docResponse.json();
        const schema = docData.schema || docData.metadata?.schema;
        const relations = schema?.relations || {};
        const records = docData.records || [];

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
                // Delete related records for each record in this document
                let totalDeleted = 0;
                for (const record of records) {
                  if (!record.id) continue;
                  
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
                        value: record.id,
                      },
                    }),
                  });

                  if (deleteRelatedResponse.ok) {
                    const deleteRelatedData = await deleteRelatedResponse.json();
                    totalDeleted += deleteRelatedData.count || 0;
                  }
                }

                if (totalDeleted > 0) {
                  deletedRelated.push({
                    document: rel.document,
                    count: totalDeleted,
                  });
                }
              }
            }
          }
        }
      }
    }

    // Delete the document
    const deleteResponse = await fetch(`${dataApiUrl}/data/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!deleteResponse.ok) {
      // 204 No Content is a success for delete
      if (deleteResponse.status !== 204) {
        const errorText = await deleteResponse.text();
        console.error('[admin/data/[id]/delete] Delete failed:', deleteResponse.status, errorText);
        return apiError(`Failed to delete document: ${deleteResponse.status}`, deleteResponse.status);
      }
    }

    return apiSuccess({
      success: true,
      message: cascade && deletedRelated.length > 0
        ? `Document deleted along with ${deletedRelated.reduce((sum, r) => sum + r.count, 0)} related records`
        : 'Document deleted successfully',
      cascadeDeleted: cascade ? deletedRelated : undefined,
    });
  } catch (error) {
    console.error('[admin/data/[id]/delete] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}
