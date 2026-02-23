/**
 * Document Delete API Route
 * 
 * Deletes a document from the data-api (source of truth).
 * RLS in data-api handles access control.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    
    // Set session JWT for Zero Trust token exchange
    setSessionJwtForUser(user.id, sessionJwt);
    
    const { fileId } = await params;

    // Delete from data-api (source of truth) - RLS will verify ownership
    try {
      await dataFetch(
        `DELETE /api/documents/[fileId] - delete document ${fileId}`,
        `/files/${fileId}`,
        {
          method: 'DELETE',
          userId: user.id,  // Required for authz token exchange (RLS passthrough)
        }
      );
    } catch (error: any) {
      if (error.statusCode === 404) {
        return apiError('Document not found', 404);
      }
      if (error.statusCode === 403) {
        return apiError('Unauthorized', 403);
      }
      console.error('[API] Failed to delete from data-api:', error);
      return apiError('Failed to delete document', error.statusCode || 500);
    }

    console.log(`[API] Document deleted: ${fileId} by ${user.email}`);

    return apiSuccess({
      message: 'Document deleted successfully',
      fileId,
    });
  } catch (error: any) {
    console.error('[API] Document delete error:', error);
    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}

