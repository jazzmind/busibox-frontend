import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

export async function GET(
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
    
    const response = await dataFetch(
      `GET /api/documents/[fileId] - get document details ${fileId}`,
      `/files/${fileId}`,
      {
        userId: user.id,  // Required for authz token exchange (RLS passthrough)
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    // Error is already logged by dataFetch with context
    return NextResponse.json(
      { error: error.message || 'Failed to fetch document details' },
      { status: error.statusCode || 500 }
    );
  }
}

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

    // Delete from data-api (source of truth)
    // RLS will verify ownership - no need to check locally first
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
      // If data-api returns 404 or 403, pass through the error
      if (error.statusCode === 404) {
        return apiError('Document not found', 404);
      }
      if (error.statusCode === 403) {
        return apiError('Unauthorized', 403);
      }
      console.error('[API] Failed to delete from data service:', error);
      return apiError('Failed to delete document', error.statusCode || 500);
    }

    return apiSuccess({
      message: 'Document deleted successfully',
      fileId,
    });
  } catch (error: any) {
    console.error('[API] Document delete error:', error);
    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}

