/**
 * Retry Video Storage API Route
 *
 * POST /api/videos/[id]/retry-storage
 * Retries downloading and storing a completed video via Agent API -> LiteLLM -> OpenAI.
 *
 * NOTE: Uses video-store (data-api) instead of Prisma.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { canAccessVideo } from '@jazzmind/busibox-app/lib/media/access-control';
import { downloadAndStoreVideo } from '@jazzmind/busibox-app/lib/media/processing';
import { normalizeVideoUrls } from '@jazzmind/busibox-app/lib/media/url-normalization';
import { VideoStatus } from '@/types/video';
import { setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';
import {
  getVideoStoreContext,
  getVideoById,
  updateVideo,
} from '@jazzmind/busibox-app/lib/media/store';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getVideoStatusViaAgent } from '@jazzmind/busibox-app/lib/media/agent-api-client';

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

    const { accessToken } = await getVideoStoreContext(user.id, sessionJwt);
    const hasAccess = await canAccessVideo(accessToken, user.id, videoId);
    if (!hasAccess) {
      return apiError('Video not found or access denied', 404);
    }

    // Get agent-api token for proxying video operations
    const userId = getUserIdFromSessionJwt(sessionJwt);
    const agentTokenResult = await exchangeWithSubjectToken({
      sessionJwt, userId: userId || user.id, audience: 'agent-api', purpose: 'video-retry-storage',
    });
    const agentAccessToken = agentTokenResult.accessToken;

    const video = await getVideoById(accessToken, videoId);
    if (!video) {
      return apiError('Video not found', 404);
    }

    if (video.status !== VideoStatus.COMPLETED && video.status !== VideoStatus.PROCESSING) {
      return apiError('Video must be completed or processing before storage can be retried', 400);
    }

    if (video.downloadUrl && video.posterUrl) {
      return apiError('Video is already stored', 400);
    }

    if (!video.openaiVideoId) {
      return apiError('Video has no OpenAI ID', 400);
    }

    // Verify the video is still completed on OpenAI side via Agent API
    try {
      const openaiVideo = await getVideoStatusViaAgent(agentAccessToken, video.openaiVideoId);

      if (openaiVideo.status !== 'completed') {
        return apiError(`OpenAI video is not completed (status: ${openaiVideo.status})`, 400);
      }
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err.message?.includes('404')) {
        return apiError('Video has expired from OpenAI servers and cannot be downloaded', 410);
      }
      throw err;
    }

    console.log(`[RETRY STORAGE] Retrying storage for video ${videoId}`);

    setSessionJwtForUser(video.ownerId, sessionJwt);

    const storageResult = await downloadAndStoreVideo(
      videoId,
      video.openaiVideoId,
      video.ownerId,
      agentAccessToken
    );

    const { roleIds } = await getVideoStoreContext(user.id, sessionJwt);
    const updatedVideo = await updateVideo(accessToken, roleIds, videoId, {
      downloadUrl: storageResult.videoUrl,
      posterUrl: storageResult.posterUrl,
      expiresAt: null,
      errorMessage: null,
    });

    if (!updatedVideo) {
      return apiError('Video not found', 404);
    }

    console.log(`[RETRY STORAGE] Successfully stored video ${videoId}`);

    return apiSuccess({
      message: 'Video storage retried successfully',
      video: normalizeVideoUrls({
        id: updatedVideo.id,
        downloadUrl: updatedVideo.downloadUrl,
        posterUrl: updatedVideo.posterUrl,
        expiresAt: updatedVideo.expiresAt,
      }),
    });
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number };
    console.error(`[RETRY STORAGE] Error for video:`, err);

    if (err.status === 404 || err.status === 410) {
      return apiError('Video has expired from OpenAI servers and cannot be downloaded', 410);
    }

    return apiError(err?.message || 'Failed to retry video storage', 500);
  }
}
