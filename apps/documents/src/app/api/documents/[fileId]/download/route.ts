/**
 * Document Download API Route
 * 
 * Downloads the original file from MinIO via the data-api (source of truth).
 * RLS in data-api handles access control.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
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

    // Download from data-api - RLS will verify ownership
    try {
      const response = await dataFetch(
        `GET /api/documents/[fileId]/download - download document ${fileId}`,
        `/files/${fileId}/download`,
        {
          userId: user.id,  // Required for authz token exchange (RLS passthrough)
        }
      );

      // Stream the file back to the client
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentDisposition = response.headers.get('content-disposition') || 
        `attachment; filename="${fileId}"`;

      return new Response(response.body, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': contentDisposition,
        },
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return apiError('Document not found', 404);
      }
      if (error.statusCode === 403) {
        return apiError('Unauthorized', 403);
      }
      throw error;
    }
  } catch (error: any) {
    // Error is already logged by dataFetch with context
    return apiError(error.message || 'An unexpected error occurred', error.statusCode || 500);
  }
}

