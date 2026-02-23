/**
 * Media File Proxy Route
 *
 * Serves media files (images, audio, video) from data-api (MinIO storage)
 * with inline content disposition so browsers render them directly.
 *
 * Used by document viewer to display images, video, and audio files.
 *
 * URL pattern: /documents/api/media/{fileId} (with basePath)
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
    setSessionJwtForUser(user.id, sessionJwt);

    const { fileId } = await params;

    // Download from data-api - RLS will verify ownership/access
    const response = await dataFetch(
      `GET /api/media/[fileId] - serve media ${fileId}`,
      `/files/${fileId}/download`,
      {
        userId: user.id,
      }
    );

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string; statusCode?: number };
    if (err.statusCode === 404) {
      return apiError('File not found', 404);
    }
    if (err.statusCode === 403) {
      return apiError('Unauthorized', 403);
    }
    return apiError(err.message || 'An unexpected error occurred', err.statusCode || 500);
  }
}
