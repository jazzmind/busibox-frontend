/**
 * Video Status Polling API Route
 *
 * GET /api/videos/[id]/status
 * Polls OpenAI for video generation status and updates database.
 *
 * NOTE: Uses video-store (data-api) instead of Prisma.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { canAccessVideo } from '@jazzmind/busibox-app/lib/media/access-control';
import { updateVideoStatusFromOpenAI } from '@jazzmind/busibox-app/lib/media/status';
import { normalizeVideoUrls } from '@jazzmind/busibox-app/lib/media/url-normalization';
import { getVideoStoreContext } from '@jazzmind/busibox-app/lib/media/store';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

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

    const { accessToken, roleIds } = await getVideoStoreContext(user.id, sessionJwt);
    const hasAccess = await canAccessVideo(accessToken, user.id, videoId);
    if (!hasAccess) {
      return apiError('Video not found or access denied', 404);
    }

    // Get agent-api token for proxying video operations via Agent API -> LiteLLM
    const userId = getUserIdFromSessionJwt(sessionJwt);
    const agentTokenResult = await exchangeWithSubjectToken({
      sessionJwt, userId: userId || user.id, audience: 'agent-api', purpose: 'video-status',
    });

    const updatedVideo = await updateVideoStatusFromOpenAI(
      videoId,
      accessToken,
      roleIds,
      sessionJwt,
      agentTokenResult.accessToken
    );

    return apiSuccess({
      video: normalizeVideoUrls({
        id: updatedVideo.id,
        status: updatedVideo.status,
        progress: updatedVideo.progress,
        downloadUrl: updatedVideo.downloadUrl,
        posterUrl: updatedVideo.posterUrl,
        errorMessage: updatedVideo.errorMessage,
        completedAt: updatedVideo.completedAt,
        expiresAt: updatedVideo.expiresAt,
        openaiVideoId: updatedVideo.openaiVideoId,
        prompt: updatedVideo.prompt,
        duration: updatedVideo.durationSeconds,
        resolution: updatedVideo.resolution,
        createdAt: updatedVideo.createdAt,
      }),
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(`Status check error for video`, err);
    return apiError(err?.message || 'Failed to get video status', 500);
  }
}
