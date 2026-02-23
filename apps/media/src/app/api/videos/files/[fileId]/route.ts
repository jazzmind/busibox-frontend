/**
 * Video File Download API Route
 *
 * Serves video files from the data service (MinIO storage).
 * This endpoint proxies video files so they can be used directly in video tags.
 *
 * NOTE: Uses video-store (data-api) instead of Prisma.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';
import { canAccessVideo } from '@jazzmind/busibox-app/lib/media/access-control';
import {
  getVideoStoreContext,
  findVideoByFileId,
} from '@jazzmind/busibox-app/lib/media/store';

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

    const { accessToken } = await getVideoStoreContext(user.id, sessionJwt);
    const video = await findVideoByFileId(accessToken, fileId);

    if (video) {
      const hasAccess = await canAccessVideo(accessToken, user.id, video.id);
      const fileOwnerId = video.ownerId;
      if (!hasAccess) {
        return apiError('Unauthorized access to file', 403);
      }

      const response = await dataFetch(
        `GET /api/videos/files/[fileId] - download video file ${fileId}`,
        `/files/${fileId}/download`,
        {
          headers: {
            'X-User-Id': fileOwnerId,
          },
          userId: fileOwnerId,
        }
      );

      let contentType = response.headers.get('content-type');

      if (!contentType) {
        try {
          const fileInfoResponse = await dataFetch(
            `GET /api/videos/files/[fileId] - get file info ${fileId}`,
            `/files/${fileId}`,
            {
              headers: {
                'X-User-Id': fileOwnerId,
              },
              userId: fileOwnerId,
            }
          );

          const fileInfo = await fileInfoResponse.json();
          contentType = fileInfo.mime_type || fileInfo.mimeType;

          if (!contentType) {
            if (
              fileInfo.filename?.includes('poster') ||
              fileInfo.filename?.match(/\.(jpg|jpeg|png|webp)$/i)
            ) {
              contentType = 'image/jpeg';
            } else {
              contentType = 'video/mp4';
            }
          }
        } catch (error) {
          console.warn(`[FILES] Failed to get file info for ${fileId}, using defaults:`, error);
          if (fileId.includes('poster')) {
            contentType = 'image/jpeg';
          } else {
            contentType = 'video/mp4';
          }
        }
      }

      console.log(`[FILES] Serving file ${fileId} with content-type: ${contentType}`);

      const headers: Record<string, string> = {
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000',
      };
      if (contentType) {
        headers['Content-Type'] = contentType;
      }

      return new Response(response.body, {
        headers,
      });
    } else {
      const response = await dataFetch(
        `GET /api/videos/files/[fileId] - download video file ${fileId}`,
        `/files/${fileId}/download`,
        {
          headers: {
            'X-User-Id': user.id,
          },
          userId: user.id,
        }
      );

      let contentType = response.headers.get('content-type');
      if (!contentType) {
        if (fileId.includes('poster')) {
          contentType = 'image/jpeg';
        } else {
          contentType = 'video/mp4';
        }
      }

      console.log(`[FILES] Serving file ${fileId} with content-type: ${contentType}`);

      const headers: Record<string, string> = {
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000',
      };
      if (contentType) {
        headers['Content-Type'] = contentType;
      }

      return new Response(response.body, {
        headers,
      });
    }
  } catch (error: unknown) {
    const err = error as { message?: string };
    return apiError(err.message || 'An unexpected error occurred', 500);
  }
}
