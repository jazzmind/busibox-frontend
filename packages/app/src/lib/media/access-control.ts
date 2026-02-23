/**
 * Access control utilities for video operations
 *
 * Provides functions to check if a user can access or modify videos
 * based on ownership and sharing settings.
 *
 * Uses video-store (data-api) instead of Prisma.
 */

import {
  getVideoById,
  listVideoShares,
} from './store';

/**
 * Check if a user can access a specific video
 *
 * Access is granted if:
 * - User is the owner
 * - Video is PUBLIC
 * - Video is SHARED and user is in the share list
 *
 * @param accessToken - Data-API access token
 * @param userId - ID of the user attempting access
 * @param videoId - ID of the video to access
 * @returns true if user has access, false otherwise
 */
export async function canAccessVideo(
  accessToken: string,
  userId: string,
  videoId: string
): Promise<boolean> {
  const video = await getVideoById(accessToken, videoId);
  if (!video) return false;

  // Owner always has access
  if (video.ownerId === userId) return true;

  // Public videos accessible by all authenticated users
  if (video.visibility === 'PUBLIC') return true;

  // Shared videos accessible if user is in share list
  if (video.visibility === 'SHARED') {
    const shares = await listVideoShares(accessToken, videoId);
    const hasShare = shares.some((s) => s.userId === userId);
    if (hasShare) return true;
  }

  // Private or no access
  return false;
}

/**
 * Require that a user owns a video, throwing an error if not
 *
 * Use this for operations that only the owner can perform
 * (e.g., delete, update sharing settings)
 *
 * @param accessToken - Data-API access token
 * @param userId - ID of the user attempting the operation
 * @param videoId - ID of the video
 * @throws Error if user is not the owner
 */
export async function requireVideoOwnership(
  accessToken: string,
  userId: string,
  videoId: string
): Promise<void> {
  const video = await getVideoById(accessToken, videoId);

  if (!video) {
    throw new Error('Video not found');
  }

  if (video.ownerId !== userId) {
    throw new Error('Unauthorized: You do not own this video');
  }
}

