/**
 * Video Library API Route
 *
 * GET /api/videos/library
 * Lists videos accessible by the current user.
 *
 * Query Parameters:
 * - filter: 'my-videos' | 'public' | 'shared' (default: 'my-videos')
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 * - status: VideoStatus filter (optional)
 *
 * Returns:
 * - videos: Array of video objects with owner info
 * - total: Total count of videos matching filter
 * - hasMore: Boolean indicating if more results exist
 *
 * NOTE: Uses video-store (data-api) instead of Prisma.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { normalizeVideoUrls } from '@jazzmind/busibox-app/lib/media/url-normalization';
import { VideoStatus } from '@/types/video';
import { getUser, getAuthzAccessToken } from '@jazzmind/busibox-app/lib/authz/user-management';
import {
  getVideoStoreContext,
  listVideos,
  listVideoShares,
  getVideoReferenceMedia,
} from '@jazzmind/busibox-app/lib/media/store';

/**
 * /api/videos/library?filter=my-videos
 * /api/videos/library?filter=public
 * /api/videos/library?filter=shared
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user, sessionJwt } = authResult;

    const { accessToken } = await getVideoStoreContext(user.id, sessionJwt);
    const authzToken = await getAuthzAccessToken(sessionJwt);

    const searchParams = request.nextUrl.searchParams;
    const filter = (searchParams.get('filter') || 'my-videos') as
      | 'my-videos'
      | 'public'
      | 'shared';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const statusFilter = searchParams.get('status') as VideoStatus | null;

    const { videos, total } = await listVideos(accessToken, {
      filter,
      userId: user.id,
      status: statusFilter && Object.values(VideoStatus).includes(statusFilter)
        ? statusFilter
        : undefined,
      limit,
      offset,
    });

    const userCache = new Map<string, { id: string; email: string } | null>();

    async function getCachedUser(userId: string) {
      if (userCache.has(userId)) {
        return userCache.get(userId)!;
      }
      const fetchedUser = await getUser(userId, authzToken);
      const result = fetchedUser ? { id: fetchedUser.id, email: fetchedUser.email } : null;
      userCache.set(userId, result);
      return result;
    }

    const transformedVideos = await Promise.all(
      videos.map(async (video) => {
        const [shares, referenceMedia] = await Promise.all([
          listVideoShares(accessToken, video.id),
          getVideoReferenceMedia(accessToken, video.id),
        ]);

        const owner = await getCachedUser(video.ownerId);
        const sharesWithUsers = await Promise.all(
          shares.map(async (share) => ({
            ...share,
            user: await getCachedUser(share.userId),
            sharer: await getCachedUser(share.sharedBy),
          }))
        );

        return normalizeVideoUrls({
          ...video,
          owner,
          shares: sharesWithUsers,
          shareCount: shares.length,
          isOwner: video.ownerId === user.id,
          referenceMedia: referenceMedia
            ? {
                id: referenceMedia.id,
                fileType: referenceMedia.fileType,
                format: referenceMedia.format,
                fileSizeBytes: referenceMedia.fileSizeBytes,
                uploadedAt: referenceMedia.uploadedAt,
              }
            : null,
        });
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        videos: transformedVideos,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + videos.length < total,
        },
      })
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Video library error:', err);

    if (err?.message?.includes('Unauthorized')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
      });
    }

    return new Response(
      JSON.stringify({
        error: err?.message || 'Failed to retrieve video library',
      }),
      { status: 500 }
    );
  }
}
