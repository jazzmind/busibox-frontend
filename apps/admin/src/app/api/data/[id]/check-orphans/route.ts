import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface OrphanCheckResult {
  recordId: string;
  orphanRelations: {
    relationName: string;
    foreignKey: string;
    foreignKeyValue: string;
    targetDocument: string;
  }[];
}

/**
 * POST /api/data/{docId}/check-orphans
 * Check multiple records for orphaned parent relations.
 * 
 * Body:
 * {
 *   recordIds: string[] - IDs of records to check
 *   relations: { [relationName]: { document: string, foreignKey: string } }
 * }
 * 
 * Returns which records have orphaned belongsTo relations.
 */
export async function POST(
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
    const body = await request.json();
    
    const { records, relations } = body as {
      records: Array<{ id: string; [key: string]: unknown }>;
      relations: { [key: string]: { type: string; document: string; foreignKey: string } };
    };

    if (!records || !Array.isArray(records)) {
      return apiError('Missing required field: records', 400);
    }

    if (!relations || typeof relations !== 'object') {
      return apiError('Missing required field: relations', 400);
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
      console.error('[admin/data/[id]/check-orphans] Token exchange failed:', exchangeError);
      return apiError('Token exchange failed', 401);
    }

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();

    // Filter to belongsTo relations only
    const belongsToRelations = Object.entries(relations).filter(
      ([, rel]) => rel.type === 'belongsTo'
    );

    if (belongsToRelations.length === 0) {
      // No belongsTo relations, no orphans possible
      return apiSuccess({ orphans: [] });
    }

    // Get document list for ID lookups
    const listResponse = await fetch(`${dataApiUrl}/data`, {
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!listResponse.ok) {
      return apiError('Failed to list documents', 500);
    }

    const listData = await listResponse.json();
    const documentList = listData.documents || [];

    // Create a map of document names to IDs
    const docNameToId: { [name: string]: string } = {};
    for (const doc of documentList) {
      docNameToId[doc.name] = doc.id;
    }

    // Check each belongsTo relation
    const orphanResults: OrphanCheckResult[] = [];

    for (const [relationName, relation] of belongsToRelations) {
      const targetDocId = docNameToId[relation.document];
      if (!targetDocId) continue;

      // Collect all unique foreign key values
      const foreignKeyValues = new Set<string>();
      const recordForeignKeys: Map<string, string> = new Map();

      for (const record of records) {
        const fkValue = record[relation.foreignKey] as string | undefined;
        if (fkValue && record.id) {
          foreignKeyValues.add(fkValue);
          recordForeignKeys.set(record.id, fkValue);
        }
      }

      if (foreignKeyValues.size === 0) continue;

      // Query target document to find which parent records exist
      // Use "in" operator if available, otherwise do individual lookups
      const existingParentIds = new Set<string>();

      // Try to query all at once using the 'in' operator
      const queryResponse = await fetch(`${dataApiUrl}/data/${targetDocId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          select: ['id'],
          where: {
            or: Array.from(foreignKeyValues).map(v => ({
              field: 'id',
              op: 'eq',
              value: v,
            })),
          },
          limit: foreignKeyValues.size,
        }),
      });

      if (queryResponse.ok) {
        const queryData = await queryResponse.json();
        const foundRecords = queryData.records || [];
        for (const rec of foundRecords) {
          if (rec.id) {
            existingParentIds.add(rec.id);
          }
        }
      }

      // Check which records have orphaned relations
      for (const record of records) {
        if (!record.id) continue;
        const fkValue = recordForeignKeys.get(record.id);
        if (!fkValue) continue;

        if (!existingParentIds.has(fkValue)) {
          // This record has an orphaned relation
          let result = orphanResults.find(r => r.recordId === record.id);
          if (!result) {
            result = { recordId: record.id, orphanRelations: [] };
            orphanResults.push(result);
          }
          result.orphanRelations.push({
            relationName,
            foreignKey: relation.foreignKey,
            foreignKeyValue: fkValue,
            targetDocument: relation.document,
          });
        }
      }
    }

    return apiSuccess({ orphans: orphanResults });
  } catch (error) {
    console.error('[admin/data/[id]/check-orphans] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}
