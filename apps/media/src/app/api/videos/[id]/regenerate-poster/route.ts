/**
 * Regenerate Poster Image API Route
 *
 * POST /api/videos/[id]/regenerate-poster
 * Regenerates the poster/thumbnail image from a stored video.
 *
 * NOTE: Uses video-store (data-api) instead of Prisma.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { requireVideoOwnership } from '@jazzmind/busibox-app/lib/media/access-control';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';
import { VideoStatus } from '@/types/video';
import { normalizeVideoUrls } from '@jazzmind/busibox-app/lib/media/url-normalization';
import {
  getVideoStoreContext,
  getVideoById,
  updateVideo,
} from '@jazzmind/busibox-app/lib/media/store';

async function extractPosterFrame(
  videoBuffer: Buffer,
  timestampSeconds: number = 0.5
): Promise<Buffer> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    try {
      await execAsync('ffmpeg -version', { timeout: 5000 });
    } catch (checkError) {
      console.error('[REGENERATE POSTER] ffmpeg not found or not executable');
      throw new Error(
        'ffmpeg is not installed or not in PATH. Please install ffmpeg: apt-get update && apt-get install -y ffmpeg'
      );
    }

    const tempDir = os.tmpdir();
    const tempVideoPath = path.join(tempDir, `video-${Date.now()}.mp4`);
    const tempPosterPath = path.join(tempDir, `poster-${Date.now()}.jpg`);

    try {
      await fs.promises.writeFile(tempVideoPath, videoBuffer);

      await execAsync(
        `ffmpeg -i "${tempVideoPath}" -ss ${timestampSeconds} -vframes 1 -q:v 2 "${tempPosterPath}"`
      );

      const posterBuffer = await fs.promises.readFile(tempPosterPath);

      await fs.promises.unlink(tempVideoPath).catch(() => {});
      await fs.promises.unlink(tempPosterPath).catch(() => {});

      return posterBuffer;
    } catch (error) {
      await fs.promises.unlink(tempVideoPath).catch(() => {});
      await fs.promises.unlink(tempPosterPath).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error('[REGENERATE POSTER] Failed to extract poster frame:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('ffmpeg') || errorMessage.includes('not found')) {
      throw new Error(
        'ffmpeg is not installed. Please install ffmpeg: apt-get update && apt-get install -y ffmpeg'
      );
    }

    throw new Error(`Failed to extract poster frame: ${errorMessage}`);
  }
}

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

    setSessionJwtForUser(user.id, sessionJwt);

    const { id: videoId } = await params;

    let timestampSeconds = 0.5;
    try {
      const body = await request.json().catch(() => ({}));
      if (body.timestampSeconds !== undefined) {
        timestampSeconds = parseFloat(body.timestampSeconds);
        if (isNaN(timestampSeconds) || timestampSeconds < 0) {
          timestampSeconds = 0.5;
        }
      }
    } catch {
      // use default
    }

    const { accessToken, roleIds } = await getVideoStoreContext(user.id, sessionJwt);
    await requireVideoOwnership(accessToken, user.id, videoId);

    const video = await getVideoById(accessToken, videoId);
    if (!video) {
      return apiError('Video not found', 404);
    }

    if (video.status !== VideoStatus.COMPLETED) {
      return apiError(`Cannot regenerate poster for video with status: ${video.status}`, 400);
    }

    if (!video.downloadUrl) {
      return apiError('Video must be stored before poster can be regenerated', 400);
    }

    const urlMatch = video.downloadUrl.match(/\/api\/videos\/files\/([^/?]+)/);
    if (!urlMatch) {
      return apiError('Invalid video URL format', 400);
    }
    const videoFileId = urlMatch[1];

    console.log(`[REGENERATE POSTER] Regenerating poster for video ${videoId}, video fileId: ${videoFileId}`);

    const videoResponse = await dataFetch(
      `POST /api/videos/[id]/regenerate-poster - download video ${videoId}`,
      `/files/${videoFileId}/download`,
      {
        headers: {
          'X-User-Id': user.id,
        },
        userId: user.id,
      }
    );

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    console.log(`[REGENERATE POSTER] Downloaded ${videoBuffer.length} bytes`);

    console.log(`[REGENERATE POSTER] Extracting poster frame at ${timestampSeconds}s`);
    const posterBuffer = await extractPosterFrame(videoBuffer, timestampSeconds);
    console.log(`[REGENERATE POSTER] Extracted poster: ${posterBuffer.length} bytes`);

    const blob = new Blob([new Uint8Array(posterBuffer)], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', blob, `${videoId}-poster.jpg`);
    formData.append(
      'metadata',
      JSON.stringify({
        source: 'video_generation',
        videoId,
        type: 'poster',
        regenerated: true,
      })
    );

    const uploadResponse = await dataFetch(
      `POST /api/videos/[id]/regenerate-poster - upload poster ${videoId}`,
      '/upload',
      {
        method: 'POST',
        headers: {
          'X-User-Id': user.id,
        },
        body: formData,
        userId: user.id,
      }
    );

    const uploadData = await uploadResponse.json();
    const posterFileId = uploadData.fileId;
    console.log(`[REGENERATE POSTER] Poster uploaded with fileId: ${posterFileId}`);

    const posterUrl = `/api/videos/files/${posterFileId}`;

    const updatedVideo = await updateVideo(accessToken, roleIds, videoId, {
      posterUrl,
    });

    if (!updatedVideo) {
      return apiError('Video not found', 404);
    }

    console.log(`[REGENERATE POSTER] Successfully regenerated poster for video ${videoId}`);

    return apiSuccess({
      message: 'Poster image regenerated successfully',
      video: normalizeVideoUrls({
        id: updatedVideo.id,
        posterUrl: updatedVideo.posterUrl,
      }),
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(`[REGENERATE POSTER] Error regenerating poster:`, err);
    return apiError(err?.message || 'Failed to regenerate poster', 500);
  }
}
