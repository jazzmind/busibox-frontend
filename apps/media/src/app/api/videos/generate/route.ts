/**
 * Video Generation API Route
 *
 * POST /api/videos/generate
 * Creates a new video generation job with OpenAI Sora2.
 *
 * NOTE: Uses video-store (data-api) instead of Prisma.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess, parseJsonBody, validateRequiredFields } from '@jazzmind/busibox-app/lib/next/middleware';
import { createVideoJob } from '@jazzmind/busibox-app/lib/media/creation';
import { getVideoStoreContext } from '@jazzmind/busibox-app/lib/media/store';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user, sessionJwt } = authResult;

    const { accessToken, roleIds } = await getVideoStoreContext(user.id, sessionJwt);

    // Get agent-api token for proxying video operations via Agent API -> LiteLLM
    const userId = getUserIdFromSessionJwt(sessionJwt);
    const agentTokenResult = await exchangeWithSubjectToken({
      sessionJwt, userId: userId || user.id, audience: 'agent-api', purpose: 'video-generation',
    });

    const body = await parseJsonBody(request);
    const validationError = validateRequiredFields(body, ['prompt', 'seconds', 'size']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { prompt, seconds, size, referenceMedia } = body;

    const newVideo = await createVideoJob({
      ownerId: user.id,
      prompt,
      durationSeconds: seconds,
      resolution: size,
      referenceMedia,
      accessToken,
      roleIds,
      agentAccessToken: agentTokenResult.accessToken,
    });

    return apiSuccess(
      {
        message: 'Video generation job created successfully.',
        video: newVideo,
      },
      201
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Video generation error:', err);
    return apiError(err?.message || 'Failed to create video generation job', 500);
  }
}
