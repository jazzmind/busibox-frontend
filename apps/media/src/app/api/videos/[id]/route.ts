/**
 * Single Video API Route
 *
 * GET /api/videos/[id] - Retrieve a single video
 * DELETE /api/videos/[id] - Delete a video (owner only)
 *
 * NOTE: Uses video-store (data-api) instead of Prisma.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { canAccessVideo, requireVideoOwnership } from '@jazzmind/busibox-app/lib/media/access-control';
import { normalizeVideoUrls } from '@jazzmind/busibox-app/lib/media/url-normalization';
import { getUser, getAuthzAccessToken } from '@jazzmind/busibox-app/lib/authz/user-management';
import {
  getVideoStoreContext,
  getVideoById,
  deleteVideo,
  listVideoShares,
  getVideoReferenceMedia,
} from '@jazzmind/busibox-app/lib/media/store';

/**
 * GET /api/videos/[id]
 * Retrieve a single video with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user, sessionJwt } = authResult;
    const { id: videoId } = await params;

    const { accessToken } = await getVideoStoreContext(user.id, sessionJwt);
    const hasAccess = await canAccessVideo(accessToken, user.id, videoId);
    if (!hasAccess) {
      return apiError('Video not found or access denied', 404);
    }

    const video = await getVideoById(accessToken, videoId);
    if (!video) {
      return apiError('Video not found', 404);
    }

    const [shares, authzToken] = await Promise.all([
      listVideoShares(accessToken, videoId),
      getAuthzAccessToken(sessionJwt),
    ]);

    const owner = await getUser(video.ownerId, authzToken);
    const sharesWithUsers = await Promise.all(
      shares.map(async (share) => {
        const shareUser = await getUser(share.userId, authzToken);
        const sharer = await getUser(share.sharedBy, authzToken);
        return {
          ...share,
          user: shareUser ? { id: shareUser.id, email: shareUser.email } : null,
          sharer: sharer ? { id: sharer.id, email: sharer.email } : null,
        };
      })
    );

    const referenceMedia = await getVideoReferenceMedia(accessToken, videoId);

    return apiSuccess({
      video: normalizeVideoUrls({
        ...video,
        owner: owner ? { id: owner.id, email: owner.email } : null,
        shares: sharesWithUsers,
        shareCount: shares.length,
        isOwner: video.ownerId === user.id,
        referenceMedia: referenceMedia
          ? {
              id: referenceMedia.id,
              fileType: referenceMedia.fileType,
              format: referenceMedia.format,
              fileSizeBytes: referenceMedia.fileSizeBytes,
              uploadedAt: referenceMedia.uploadedAt,
              base64Data: referenceMedia.base64Data,
            }
          : null,
      }),
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Video retrieval error:', err);
    return apiError(err?.message || 'Failed to retrieve video', 500);
  }
}

/**
 * DELETE /api/videos/[id]
 * Delete a video and all associated data (owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user, sessionJwt } = authResult;
    const { id: videoId } = await params;

    const { accessToken, roleIds } = await getVideoStoreContext(user.id, sessionJwt);
    await requireVideoOwnership(accessToken, user.id, videoId);
    await deleteVideo(accessToken, roleIds, videoId);

    console.log(`Video ${videoId} deleted by user ${user.id}`);

    return apiSuccess({ message: 'Video deleted successfully' });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Video deletion error:', err);
    return apiError(err?.message || 'Failed to delete video', 500);
  }
}
