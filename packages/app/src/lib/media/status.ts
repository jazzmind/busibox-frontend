import { downloadAndStoreVideo } from './processing';
import { VideoStatus } from '../../types/video';
import { setSessionJwtForUser } from '../data/app-client';
import { getVideoById, updateVideo } from './store';
import { getVideoStatusViaAgent } from './agent-api-client';

function mapOpenAIStatus(openaiStatus: string): VideoStatus {
  // OpenAI uses: "queued" | "in_progress" | "completed" | "failed"
  switch (openaiStatus.toLowerCase()) {
    case 'queued':
      return VideoStatus.QUEUED;
    case 'in_progress':
      return VideoStatus.PROCESSING;
    case 'completed':
      return VideoStatus.COMPLETED;
    case 'failed':
      return VideoStatus.FAILED;
    default:
      return VideoStatus.QUEUED;
  }
}

// Track in-flight storage operations to prevent duplicate downloads
const storageInFlight = new Set<string>();

/**
 * Fire-and-forget: download video from OpenAI and store in MinIO.
 * Runs in the background so the status endpoint can return immediately.
 */
async function backgroundStoreVideo(
  videoId: string,
  openaiVideoId: string,
  ownerId: string,
  accessToken: string,
  roleIds: string[],
  sessionJwt: string | undefined,
  agentAccessToken: string
) {
  if (storageInFlight.has(videoId)) {
    console.log(`[VIDEO STORAGE BG] Already storing video ${videoId}, skipping duplicate`);
    return;
  }

  storageInFlight.add(videoId);

  try {
    console.log(`[VIDEO STORAGE BG] Starting background storage for video ${videoId}`);

    if (sessionJwt) {
      setSessionJwtForUser(ownerId, sessionJwt);
    }

    const storageResult = await downloadAndStoreVideo(videoId, openaiVideoId, ownerId, agentAccessToken);

    // Update DB with stored file URLs
    await updateVideo(accessToken, roleIds, videoId, {
      downloadUrl: storageResult.videoUrl,
      posterUrl: storageResult.posterUrl,
      expiresAt: null,
      errorMessage: null,
    });

    console.log('[VIDEO STORAGE BG] Video stored successfully:', {
      videoId,
      videoUrl: storageResult.videoUrl,
      posterUrl: storageResult.posterUrl,
      videoSize: storageResult.videoSize,
      posterSize: storageResult.posterSize,
    });
  } catch (error) {
    console.error(`[VIDEO STORAGE BG] Failed to store video ${videoId}:`, error);
    // Mark as storage-pending so the next poll will retry
    try {
      await updateVideo(accessToken, roleIds, videoId, {
        errorMessage: `Storage pending: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } catch (updateError) {
      console.error(`[VIDEO STORAGE BG] Failed to update error message for ${videoId}:`, updateError);
    }
  } finally {
    storageInFlight.delete(videoId);
  }
}

export async function updateVideoStatusFromOpenAI(
  videoId: string,
  accessToken: string,
  roleIds: string[],
  sessionJwt?: string,
  agentAccessToken?: string
) {
  const video = await getVideoById(accessToken, videoId);

  if (!video) {
    throw new Error('Video not found');
  }

  // If video is already failed, return it without re-processing
  if (video.status === VideoStatus.FAILED) {
    console.log(`[VIDEO STATUS] Video ${videoId} already FAILED, skipping processing`);
    return video;
  }

  // If video is COMPLETED and has stored files, return it without re-processing
  if (video.status === VideoStatus.COMPLETED && video.downloadUrl && video.posterUrl) {
    console.log(`[VIDEO STATUS] Video ${videoId} already COMPLETED with stored files, skipping processing`);
    return video;
  }

  // If video is COMPLETED but storage is still in-flight, return current state
  if (video.status === VideoStatus.COMPLETED && storageInFlight.has(videoId)) {
    console.log(`[VIDEO STATUS] Video ${videoId} COMPLETED, storage in progress...`);
    return video;
  }

  // If video is COMPLETED but missing files (storage failed previously), retry in background
  if (video.status === VideoStatus.COMPLETED && (!video.downloadUrl || !video.posterUrl)) {
    if (video.openaiVideoId && agentAccessToken) {
      console.log(`[VIDEO STATUS] Video ${videoId} COMPLETED but missing stored files, retrying storage...`);
      // Fire-and-forget background storage
      backgroundStoreVideo(
        videoId, video.openaiVideoId, video.ownerId,
        accessToken, roleIds, sessionJwt, agentAccessToken
      );
    }
    return video;
  }

  if (!video.openaiVideoId) {
    throw new Error('Video has no OpenAI ID');
  }

  if (!agentAccessToken) {
    throw new Error('Agent access token required for video status check');
  }

  // Call Agent API which proxies to LiteLLM -> OpenAI
  const openaiVideo = await getVideoStatusViaAgent(agentAccessToken, video.openaiVideoId);
  const newStatus = mapOpenAIStatus(openaiVideo.status);

  console.log('[VIDEO STATUS] OpenAI response for', video.openaiVideoId, ':', JSON.stringify(openaiVideo, null, 2));

  const updateData: Record<string, unknown> = {
    status: newStatus,
    progress: openaiVideo.progress || null,
  };

  if (newStatus === VideoStatus.COMPLETED) {
    updateData.completedAt = new Date();

    // Check if files are already stored (race condition guard)
    const existingVideo = await getVideoById(accessToken, videoId);
    if (existingVideo?.downloadUrl && existingVideo?.posterUrl) {
      console.log('[VIDEO STATUS] Video already stored, skipping download');
      updateData.expiresAt = null;
    } else {
      // Mark as COMPLETED immediately and kick off background storage
      console.log('[VIDEO STATUS] Video completed on OpenAI, starting background storage...');

      // Update status to COMPLETED right away so the UI shows completion
      updateData.status = VideoStatus.COMPLETED;
      updateData.errorMessage = null;

      // Fire-and-forget: download and store in background
      backgroundStoreVideo(
        videoId, video.openaiVideoId!, video.ownerId,
        accessToken, roleIds, sessionJwt, agentAccessToken
      );
    }
  }

  if (newStatus === VideoStatus.FAILED) {
    updateData.errorMessage = (openaiVideo.error as { message?: string })?.message || 'Video generation failed';
  }

  const updatedVideo = await updateVideo(
    accessToken,
    roleIds,
    videoId,
    updateData as Parameters<typeof updateVideo>[3]
  );

  if (!updatedVideo) {
    throw new Error('Video not found');
  }

  console.log(`Video ${videoId} status updated: ${video.status} -> ${newStatus}`);

  return updatedVideo;
}
