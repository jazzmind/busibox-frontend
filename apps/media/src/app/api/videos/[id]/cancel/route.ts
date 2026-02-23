/**
 * Cancel Video Job API Route
 *
 * POST /api/videos/[id]/cancel
 * Cancels a queued or processing video job at OpenAI.
 *
 * Only works for videos that are QUEUED, PENDING, or PROCESSING.
 * Completed or failed videos cannot be cancelled.
 *
 * NOTE: Uses video-store (data-api) instead of Prisma.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { requireVideoOwnership } from '@jazzmind/busibox-app/lib/media/access-control';
import { VideoStatus } from '@/types/video';
import {
  getVideoStoreContext,
  getVideoById,
  updateVideo,
} from '@jazzmind/busibox-app/lib/media/store';

export async function POST(
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

    const video = await getVideoById(accessToken, videoId);
    if (!video) {
      return apiError('Video not found', 404);
    }

    const cancellableStatuses = [
      VideoStatus.QUEUED,
      VideoStatus.PENDING,
      VideoStatus.PROCESSING,
    ];
    if (!cancellableStatuses.includes(video.status as VideoStatus)) {
      return apiError(`Cannot cancel video with status: ${video.status}`, 400);
    }

    if (!video.openaiVideoId) {
      return apiError('Video has no OpenAI ID', 400);
    }

    const updatedVideo = await updateVideo(accessToken, roleIds, videoId, {
      status: VideoStatus.FAILED,
      errorMessage: 'Video generation cancelled by user',
    });

    if (!updatedVideo) {
      return apiError('Video not found', 404);
    }

    console.log(`[CANCEL] Video ${videoId} cancelled by user ${user.id}`);

    return apiSuccess({
      message: 'Video cancelled successfully',
      video: {
        id: updatedVideo.id,
        status: updatedVideo.status,
        errorMessage: updatedVideo.errorMessage,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(`[CANCEL] Error cancelling video:`, err);
    return apiError(err?.message || 'Failed to cancel video', 500);
  }
}
