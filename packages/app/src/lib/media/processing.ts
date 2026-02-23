/**
 * Video Processing Utilities
 * 
 * Functions for downloading videos, extracting poster frames,
 * and storing them using the data service (MinIO).
 * 
 * NOTE: Videos are stored but NOT processed. This means:
 * - Videos are uploaded to MinIO and stored permanently
 * - No transcript generation
 * - No frame sampling for descriptions
 * - No analysis or metadata extraction
 * 
 * Processing (transcript, frame sampling, description generation) will be added later.
 * For now, videos are simply stored for retrieval/download.
 */

import { dataFetch } from '../data/app-client'
import { downloadVideoViaAgent } from './agent-api-client'

// Video storage result type
export interface VideoStorageResult {
  /** URL to the stored video file */
  videoUrl: string
  /** URL to the stored poster/thumbnail image */
  posterUrl: string
  /** Size of the video in bytes */
  videoSize: number
  /** Size of the poster in bytes */
  posterSize: number
}

/**
 * Extract first frame from video as JPEG poster image
 * 
 * Uses sharp and fluent-ffmpeg to extract the first frame.
 * Falls back to a placeholder if extraction fails.
 */
async function extractPosterFrame(videoBuffer: Buffer): Promise<Buffer> {
  try {
    // We'll use ffmpeg through a temporary file approach
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    const fs = await import('fs')
    const path = await import('path')
    const os = await import('os')

    // Check if ffmpeg is available by trying to run it with --version
    // This is more reliable than 'which' in some environments
    try {
      await execAsync('ffmpeg -version', { timeout: 5000 })
    } catch (checkError) {
      console.error('[VIDEO STORAGE] ffmpeg not found or not executable, using fallback');
      // Return fallback image if ffmpeg is not available
      const fallbackBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA='
      return Buffer.from(fallbackBase64, 'base64')
    }

    // Create temp files
    const tempDir = os.tmpdir()
    const tempVideoPath = path.join(tempDir, `video-${Date.now()}.mp4`)
    const tempPosterPath = path.join(tempDir, `poster-${Date.now()}.jpg`)

    try {
      // Write video to temp file
      await fs.promises.writeFile(tempVideoPath, videoBuffer)

      // Extract first frame using ffmpeg
      // -ss 0.5: seek to 0.5 seconds (avoid black frames at start)
      // -vframes 1: extract only 1 frame
      // -q:v 2: high quality JPEG (scale 2-31, lower is better)
      await execAsync(
        `ffmpeg -i "${tempVideoPath}" -ss 0.5 -vframes 1 -q:v 2 "${tempPosterPath}"`
      )

      // Read the poster
      const posterBuffer = await fs.promises.readFile(tempPosterPath)

      // Cleanup
      await fs.promises.unlink(tempVideoPath).catch(() => {})
      await fs.promises.unlink(tempPosterPath).catch(() => {})

      return posterBuffer
    } catch (error) {
      // Cleanup on error
      await fs.promises.unlink(tempVideoPath).catch(() => {})
      await fs.promises.unlink(tempPosterPath).catch(() => {})
      throw error
    }
  } catch (error) {
    console.error('Failed to extract poster frame:', error)
    
    // Return a minimal 1x1 pixel JPEG as fallback
    // This is a base64-encoded 1x1 black JPEG
    const fallbackBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA='
    return Buffer.from(fallbackBase64, 'base64')
  }
}

/**
 * Upload file buffer to data service
 */
async function uploadFileToData(
  buffer: Buffer,
  filename: string,
  contentType: string,
  userId: string,
  metadata?: Record<string, any>
): Promise<{ fileId: string }> {
  // Use built-in FormData (Node.js 18+) with Blob
  // Create a Blob from the buffer (convert Buffer to Uint8Array for Blob compatibility)
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
  
  const formData = new FormData();
  formData.append('file', blob, filename);
  
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  const response = await dataFetch(
    `uploadFileToData (${filename}, ${contentType})`,
    '/upload',
    {
      method: 'POST',
      headers: {
        'X-User-Id': userId,
        // Don't set Content-Type - let fetch set it with boundary
      },
      body: formData,
      userId, // Required for auth token exchange
      timeout: 180000, // 3 minutes - video files can be large (tens of MB)
    }
  );

  const data = await response.json();
  return { fileId: data.fileId };
}

/**
 * Download video from OpenAI and store it with a poster image
 * 
 * @param videoId - Our internal video ID
 * @param openaiVideoId - OpenAI's video ID
 * @param userId - User ID who owns the video
 * @returns URLs and sizes for the stored video and poster
 */
export async function downloadAndStoreVideo(
  videoId: string,
  openaiVideoId: string,
  userId: string,
  agentAccessToken?: string
): Promise<VideoStorageResult> {
  console.log(`[VIDEO STORAGE] Starting download and storage for video ${videoId}`)

  // Download video via Agent API -> LiteLLM -> OpenAI
  console.log(`[VIDEO STORAGE] Downloading from OpenAI via Agent API: ${openaiVideoId}`)
  if (!agentAccessToken) {
    throw new Error('Agent access token required for video content download')
  }
  const videoBuffer = await downloadVideoViaAgent(agentAccessToken, openaiVideoId)
  console.log(`[VIDEO STORAGE] Downloaded ${videoBuffer.length} bytes`)

  // Extract poster frame
  console.log(`[VIDEO STORAGE] Extracting poster frame`)
  const posterBuffer = await extractPosterFrame(videoBuffer)
  console.log(`[VIDEO STORAGE] Extracted poster: ${posterBuffer.length} bytes`)

  // Upload video to data service
  console.log(`[VIDEO STORAGE] Uploading video to data service`)
  const videoUploadResult = await uploadFileToData(
    videoBuffer,
    `${videoId}-video.mp4`,
    'video/mp4',
    userId,
    {
      source: 'video_generation',
      videoId,
      openaiVideoId,
      type: 'video',
    }
  )
  console.log(`[VIDEO STORAGE] Video uploaded with fileId: ${videoUploadResult.fileId}`)

  // Upload poster to data service
  console.log(`[VIDEO STORAGE] Uploading poster to data service`)
  const posterUploadResult = await uploadFileToData(
    posterBuffer,
    `${videoId}-poster.jpg`,
    'image/jpeg',
    userId,
    {
      source: 'video_generation',
      videoId,
      openaiVideoId,
      type: 'poster',
    }
  )
  console.log(`[VIDEO STORAGE] Poster uploaded with fileId: ${posterUploadResult.fileId}`)

  // Generate URLs using relative paths - these will work regardless of the host
  // The browser will resolve these relative to the current origin
  // This ensures videos work whether accessed via localhost, container IP, or domain
  const videoUrl = `/api/videos/files/${videoUploadResult.fileId}`
  const posterUrl = `/api/videos/files/${posterUploadResult.fileId}`

  return {
    videoUrl,
    posterUrl,
    videoSize: videoBuffer.length,
    posterSize: posterBuffer.length,
  }
}

