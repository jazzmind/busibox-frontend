/**
 * Resubmit Video Job API Route
 *
 * POST /api/videos/[id]/resubmit
 * Resubmits a failed or cancelled video job via Agent API -> LiteLLM -> OpenAI.
 *
 * Creates a new OpenAI video job with the same parameters and updates the video record.
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
  getVideoReferenceMedia,
  updateVideo,
} from '@jazzmind/busibox-app/lib/media/store';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';
import { createVideoViaAgent } from '@jazzmind/busibox-app/lib/media/agent-api-client';
import { resizeReferenceImage } from '@jazzmind/busibox-app/lib/media/image-resize';

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

    // Get agent-api token for proxying video operations
    const userId = getUserIdFromSessionJwt(sessionJwt);
    const agentTokenResult = await exchangeWithSubjectToken({
      sessionJwt, userId: userId || user.id, audience: 'agent-api', purpose: 'video-resubmit',
    });

    const video = await getVideoById(accessToken, videoId);
    if (!video) {
      return apiError('Video not found', 404);
    }

    const referenceMediaDoc = await getVideoReferenceMedia(accessToken, videoId);

    if (video.status !== VideoStatus.FAILED && video.status !== VideoStatus.EXPIRED) {
      return apiError(`Cannot resubmit video with status: ${video.status}`, 400);
    }

    const referenceMedia = referenceMediaDoc
      ? {
          base64: referenceMediaDoc.base64Data,
          fileType: referenceMediaDoc.fileType as 'image' | 'video',
          format: referenceMediaDoc.format,
          fileSizeBytes: referenceMediaDoc.fileSizeBytes,
        }
      : undefined;

    // Prepare reference image if present
    let inputReferenceBase64: string | undefined;
    let inputReferenceFilename: string | undefined;

    if (referenceMedia?.base64 && referenceMedia.fileType === 'image') {
      console.log(`[RESUBMIT] Resizing reference image to match video resolution: ${video.resolution}`);
      inputReferenceBase64 = await resizeReferenceImage(referenceMedia.base64, video.resolution);
      inputReferenceFilename = `reference-${Date.now()}.jpg`;
      console.log('[RESUBMIT] Added resized reference image for resubmit');
    }

    // Call Agent API which proxies to LiteLLM -> OpenAI
    // Uses 'video' purpose name which LiteLLM resolves to the configured video model
    const openaiResponse = await createVideoViaAgent(agentTokenResult.accessToken, {
      model: 'video',
      prompt: video.prompt.trim(),
      seconds: video.durationSeconds.toString(),
      size: video.resolution,
      inputReferenceBase64,
      inputReferenceFilename,
    });

    let initialStatus: VideoStatus;
    switch (openaiResponse.status) {
      case 'queued':
        initialStatus = VideoStatus.QUEUED;
        break;
      case 'in_progress':
        initialStatus = VideoStatus.PROCESSING;
        break;
      case 'completed':
        initialStatus = VideoStatus.COMPLETED;
        break;
      case 'failed':
        initialStatus = VideoStatus.FAILED;
        break;
      default:
        initialStatus = VideoStatus.QUEUED;
    }

    const updatedVideo = await updateVideo(accessToken, roleIds, videoId, {
      openaiVideoId: openaiResponse.id,
      status: initialStatus,
      progress: openaiResponse.progress || null,
      errorMessage: null,
      expiresAt: null,
      downloadUrl: null,
      posterUrl: null,
      completedAt: null,
    });

    if (!updatedVideo) {
      return apiError('Video not found', 404);
    }

    console.log(`[RESUBMIT] Video ${videoId} resubmitted by user ${user.id}, new OpenAI ID: ${openaiResponse.id}`);

    return apiSuccess({
      message: 'Video resubmitted successfully',
      video: {
        id: updatedVideo.id,
        openaiVideoId: updatedVideo.openaiVideoId,
        status: updatedVideo.status,
        prompt: updatedVideo.prompt,
        durationSeconds: updatedVideo.durationSeconds,
        resolution: updatedVideo.resolution,
        createdAt: updatedVideo.createdAt,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(`[RESUBMIT] Error resubmitting video:`, err);
    return apiError(err?.message || 'Failed to resubmit video', 500);
  }
}
