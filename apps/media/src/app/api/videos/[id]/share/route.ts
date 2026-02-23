/**
 * Video Sharing API Route
 *
 * POST /api/videos/[id]/share - Share video with specific users
 * DELETE /api/videos/[id]/share - Remove share access
 *
 * NOTE: Uses video-store (data-api) instead of Prisma.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import { requireVideoOwnership } from '@jazzmind/busibox-app/lib/media/access-control';
import { VideoVisibility } from '@/types/video';
import { getUser, getAuthzAccessToken } from '@jazzmind/busibox-app/lib/authz/user-management';
import {
  getVideoStoreContext,
  getVideoById,
  listVideoShares,
  createVideoShare,
  deleteVideoShareByVideoAndUser,
  updateVideo,
} from '@jazzmind/busibox-app/lib/media/store';

/**
 * POST /api/videos/[id]/share
 * Share video with specific user(s)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user: sharer, sessionJwt } = authResult;
    const { id: videoId } = await params;

    const { accessToken, roleIds } = await getVideoStoreContext(sharer.id, sessionJwt);
    await requireVideoOwnership(accessToken, sharer.id, videoId);

    const body = await parseJsonBody(request);

    const { shareWithUserId, shareWithUserIds } = body;
    const userIds: string[] = shareWithUserIds || (shareWithUserId ? [shareWithUserId] : []);

    if (userIds.length === 0) {
      return apiError('At least one user ID is required. Provide shareWithUserId or shareWithUserIds.', 400);
    }

    const validUserIds = userIds.filter((id) => id !== sharer.id);
    if (validUserIds.length === 0) {
      return apiError('You cannot share a video with yourself.', 400);
    }

    const video = await getVideoById(accessToken, videoId);
    if (!video) {
      return apiError('Video not found.', 404);
    }

    const authzToken = await getAuthzAccessToken(sessionJwt);
    const targetUsers: { id: string; email: string }[] = [];
    const missingIds: string[] = [];

    await Promise.all(
      validUserIds.map(async (userId) => {
        const user = await getUser(userId, authzToken);
        if (user && user.status === 'ACTIVE') {
          targetUsers.push({ id: user.id, email: user.email });
        } else {
          missingIds.push(userId);
        }
      })
    );

    if (missingIds.length > 0) {
      return apiError(`Some users not found or inactive: ${missingIds.join(', ')}`, 404);
    }

    const existingShares = await listVideoShares(accessToken, videoId);
    const existingUserIds = new Set(existingShares.map((s) => s.userId));
    const newUserIds = validUserIds.filter((id) => !existingUserIds.has(id));

    const createdShares = [];
    for (const userId of newUserIds) {
      const share = await createVideoShare(accessToken, roleIds, videoId, {
        userId,
        sharedBy: sharer.id,
      });
      createdShares.push(share);
    }

    if (video.visibility !== VideoVisibility.SHARED && (createdShares.length > 0 || existingShares.length > 0)) {
      await updateVideo(accessToken, roleIds, videoId, {
        visibility: VideoVisibility.SHARED,
      });
    }

    const userEmails = targetUsers.map((u) => u.email).join(', ');
    const message =
      createdShares.length > 0
        ? `Video shared successfully with ${userEmails}.`
        : `Video already shared with ${userEmails}.`;

    return apiSuccess(
      {
        message,
        shares: createdShares,
        alreadyShared: existingShares.length,
      },
      201
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Video share error:', err);
    return apiError(err?.message || 'Failed to share video', 500);
  }
}

/**
 * DELETE /api/videos/[id]/share
 * Remove share access from specific user
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

    const body = await request.json().catch(() => ({}));
    const { userId } = body;

    if (!userId) {
      return apiError('User ID is required', 400);
    }

    await deleteVideoShareByVideoAndUser(accessToken, roleIds, videoId, userId);

    const remainingShares = await listVideoShares(accessToken, videoId);
    if (remainingShares.length === 0) {
      await updateVideo(accessToken, roleIds, videoId, {
        visibility: VideoVisibility.PRIVATE,
      });
    }

    return apiSuccess({
      message: 'Share removed successfully',
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Share removal error:', err);

    if (err?.message?.includes('Unauthorized')) {
      return apiError(err.message, 401);
    }

    return apiError(err?.message || 'Failed to remove share', 500);
  }
}
