import { validateBase64ReferenceMedia } from './upload';
import { resizeReferenceImage } from './image-resize';
import { VideoStatus, VideoVisibility } from '../../types/video';
import { ReferenceMediaUpload } from '../../types/video';
import {
  createVideo,
  createVideoReferenceMedia,
  type VideoCreateInput,
} from './store';
import { createVideoViaAgent } from './agent-api-client';

const ALLOWED_DURATIONS = [4, 8, 12];

interface CreateVideoJobParams {
  ownerId: string;
  prompt: string;
  durationSeconds: number;
  resolution: string;
  referenceMedia?: ReferenceMediaUpload;
  accessToken: string;
  roleIds: string[];
  /** Token for Agent API (video operations are proxied through Agent API -> LiteLLM) */
  agentAccessToken: string;
}

export async function createVideoJob({
  ownerId,
  prompt,
  durationSeconds,
  resolution,
  referenceMedia,
  accessToken,
  roleIds,
  agentAccessToken,
}: CreateVideoJobParams) {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Prompt is required and must be a non-empty string');
  }

  if (!ALLOWED_DURATIONS.includes(durationSeconds)) {
    throw new Error(`Duration must be one of: ${ALLOWED_DURATIONS.join(', ')} seconds`);
  }

  if (referenceMedia) {
    const { base64, fileType, format, fileSizeBytes } = referenceMedia;
    if (!base64 || !fileType || !format || !fileSizeBytes) {
      throw new Error('Invalid reference media: missing required fields');
    }
    const validation = validateBase64ReferenceMedia(base64);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid reference media');
    }
  }

  // Build params for Agent API proxy
  let inputReferenceBase64: string | undefined;
  let inputReferenceFilename: string | undefined;

  // Handle reference media - resize image and send as base64 to Agent API
  if (referenceMedia?.base64 && referenceMedia.fileType === 'image') {
    console.log(`[VIDEO CREATION] Resizing reference image to match video resolution: ${resolution}`);
    inputReferenceBase64 = await resizeReferenceImage(referenceMedia.base64, resolution);
    inputReferenceFilename = `reference-${Date.now()}.jpg`;
    console.log('[VIDEO CREATION] Added resized reference image for video generation');
  } else if (referenceMedia?.base64 && referenceMedia.fileType === 'video') {
    console.warn('[VIDEO CREATION] Video reference media provided - video references may not be fully supported');
  }

  console.log('Generating video with params:', {
    model: 'video',
    prompt: prompt.trim(),
    seconds: durationSeconds.toString(),
    size: resolution,
    hasReferenceMedia: !!referenceMedia,
    referenceMediaType: referenceMedia?.fileType,
  });

  // Call Agent API which proxies to LiteLLM -> OpenAI
  // Uses 'video' purpose name which LiteLLM resolves to the configured video model
  const openaiResponse = await createVideoViaAgent(agentAccessToken, {
    model: 'video',
    prompt: prompt.trim(),
    seconds: durationSeconds.toString(),
    size: resolution,
    inputReferenceBase64,
    inputReferenceFilename,
  });

  // Map OpenAI status to our VideoStatus enum
  // OpenAI uses: "queued" | "in_progress" | "completed" | "failed"
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

  const videoInput: VideoCreateInput = {
    ownerId,
    openaiVideoId: openaiResponse.id,
    prompt: prompt.trim(),
    durationSeconds,
    resolution,
    status: initialStatus,
    progress: openaiResponse.progress || null,
    visibility: VideoVisibility.PRIVATE,
    openaiModel: 'video',
    completedAt: null,
    expiresAt: null,
    downloadUrl: null,
    posterUrl: null,
    errorMessage: null,
  };

  const video = await createVideo(accessToken, roleIds, videoInput);

  if (referenceMedia) {
    await createVideoReferenceMedia(accessToken, roleIds, {
      videoId: video.id,
      fileType: referenceMedia.fileType,
      format: referenceMedia.format,
      fileSizeBytes: referenceMedia.fileSizeBytes,
      base64Data: referenceMedia.base64,
    });
  }

  console.log('Created video record:', video.id, 'with status:', video.status);

  return {
    id: video.id,
    openaiVideoId: openaiResponse.id,
    status: video.status,
    prompt: video.prompt,
    durationSeconds: video.durationSeconds,
    resolution: video.resolution,
    createdAt: video.createdAt,
    hasReferenceMedia: !!referenceMedia,
  };
}
