/**
 * Media File Proxy Route
 *
 * Serves files from data-api (MinIO storage) through a browser-reachable,
 * same-origin URL. The agent's tools link to this path:
 *
 *   - images from generate_image / render_chart and audio from text_to_speech
 *     (rendered inline by the chat markdown renderer)
 *   - Excel and Word files from create_spreadsheet / create_document
 *     (linked with `?download=1`, which makes the browser save the file
 *     under its real name instead of trying to display it)
 *
 * URL pattern: /portal/api/media/{fileId}[?download=1]
 *
 * This route was removed in Feb 2026 as "unused"; the agent never stopped
 * emitting /portal/api/media links. The same handler exists in the media and
 * documents apps for their own base paths.
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
    const download = request.nextUrl.searchParams.get('download') === '1';

    // Download from data-api - RLS will verify ownership/access
    const response = await dataFetch(
      `GET /api/media/[fileId] - serve media ${fileId}`,
      `/files/${fileId}/download`,
      {
        userId: user.id,
      }
    );

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    // data-api sends `attachment; filename="<original name>"`; keep it when the
    // caller asked for a download so the saved file has its real name.
    const upstreamDisposition = response.headers.get('content-disposition');
    const contentDisposition = download
      ? upstreamDisposition || 'attachment'
      : 'inline';

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': download ? 'private, max-age=0' : 'public, max-age=31536000, immutable',
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
