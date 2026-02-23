/**
 * Remix Video API Route
 *
 * POST /api/videos/[id]/remix
 * Creates a remix of an existing video with a modified prompt.
 *
 * Uses the same parameters (duration, resolution, reference media) as the original
 * but with a new prompt. Creates a new video record.
 *
 * NOTE: Uses video-store (data-api) instead of Prisma.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess, parseJsonBody, validateRequiredFields } from '@jazzmind/busibox-app/lib/next/middleware';
import { requireVideoOwnership } from '@jazzmind/busibox-app/lib/media/access-control';
import { createVideoJob } from '@jazzmind/busibox-app/lib/media/creation';
import { ReferenceMediaType, ReferenceMediaFormat } from '@/types/video';
import {
  getVideoStoreContext,
  getVideoById,
  getVideoReferenceMedia,
} from '@jazzmind/busibox-app/lib/media/store';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

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

    // Get agent-api token for proxying video operations via Agent API -> LiteLLM
    const userId = getUserIdFromSessionJwt(sessionJwt);
    const agentTokenResult = await exchangeWithSubjectToken({
      sessionJwt, userId: userId || user.id, audience: 'agent-api', purpose: 'video-remix',
    });

    const body = await parseJsonBody(request);
    const validationError = validateRequiredFields(body, ['remixPrompt']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { remixPrompt } = body;

    if (!remixPrompt || typeof remixPrompt !== 'string' || remixPrompt.trim().length === 0) {
      return apiError('Remix prompt is required and must be a non-empty string', 400);
    }

    const originalVideo = await getVideoById(accessToken, videoId);
    if (!originalVideo) {
      return apiError('Original video not found', 404);
    }

    const referenceMediaDoc = await getVideoReferenceMedia(accessToken, videoId);
    const referenceMedia = referenceMediaDoc
      ? {
          base64: referenceMediaDoc.base64Data,
          fileType: referenceMediaDoc.fileType as ReferenceMediaType,
          format: referenceMediaDoc.format as ReferenceMediaFormat,
          fileSizeBytes: referenceMediaDoc.fileSizeBytes,
        }
      : undefined;

    const remixVideo = await createVideoJob({
      ownerId: user.id,
      prompt: remixPrompt.trim(),
      durationSeconds: originalVideo.durationSeconds,
      resolution: originalVideo.resolution,
      referenceMedia,
      accessToken,
      roleIds,
      agentAccessToken: agentTokenResult.accessToken,
    });

    console.log(`[REMIX] Created remix video ${remixVideo.id} from original ${videoId} by user ${user.id}`);

    return apiSuccess(
      {
        message: 'Remix video created successfully',
        video: remixVideo,
      },
      201
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(`[REMIX] Error creating remix:`, err);
    return apiError(err?.message || 'Failed to create remix video', 500);
  }
}
