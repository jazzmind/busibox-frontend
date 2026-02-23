/**
 * Video Visibility API Route
 *
 * PUT /api/videos/[id]/visibility - Change video visibility
 *
 * NOTE: Uses video-store (data-api) instead of Prisma.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { requireVideoOwnership } from '@jazzmind/busibox-app/lib/media/access-control';
import { VideoVisibility } from '@/types/video';
import { getUser, getAuthzAccessToken } from '@jazzmind/busibox-app/lib/authz/user-management';
import {
  getVideoStoreContext,
  getVideoById,
  updateVideo,
  listVideoShares,
  deleteVideoShare,
} from '@jazzmind/busibox-app/lib/media/store';

/**
 * PUT /api/videos/[id]/visibility
 * Change video visibility (PRIVATE, PUBLIC, SHARED)
 */
export async function PUT(
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

    const body = await request.json();
    const { visibility } = body;

    const validVisibilities = [
      VideoVisibility.PRIVATE,
      VideoVisibility.PUBLIC,
      VideoVisibility.SHARED,
    ];
    if (!validVisibilities.includes(visibility)) {
      return apiError('Invalid visibility. Must be PRIVATE, PUBLIC, or SHARED', 400);
    }

    if (visibility === VideoVisibility.PRIVATE) {
      const shares = await listVideoShares(accessToken, videoId);
      for (const share of shares) {
        await deleteVideoShare(accessToken, roleIds, share.id);
      }
    }

    const updatedVideo = await updateVideo(accessToken, roleIds, videoId, {
      visibility,
    });

    if (!updatedVideo) {
      return apiError('Video not found', 404);
    }

    const authzToken = await getAuthzAccessToken(sessionJwt);
    const owner = await getUser(updatedVideo.ownerId, authzToken);
    const shares = await listVideoShares(accessToken, videoId);

    return apiSuccess({
      video: {
        ...updatedVideo,
        owner: owner ? { id: owner.id, email: owner.email } : null,
        shareCount: shares.length,
        referenceMedia: null,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Video visibility update error:', err);
    return apiError(err?.message || 'Failed to update video visibility', 500);
  }
}
