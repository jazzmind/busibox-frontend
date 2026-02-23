/**
 * URL Normalization Utilities
 * 
 * Normalizes video and poster URLs to use relative paths.
 * This ensures URLs work regardless of the host (localhost, container IP, or domain).
 */

/**
 * Normalize a URL to a relative path if it's a localhost or container IP URL
 * 
 * Converts:
 * - http://localhost:3000/api/videos/files/... → /api/videos/files/...
 * - http://10.96.200.201:3000/api/videos/files/... → /api/videos/files/...
 * - /api/videos/files/... → /api/videos/files/... (unchanged)
 * 
 * @param url - The URL to normalize
 * @returns Normalized relative path
 */
export function normalizeVideoUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  // If it's already a relative path, return as-is
  if (url.startsWith('/')) {
    return url;
  }

  // Extract the path from absolute URLs
  try {
    const urlObj = new URL(url);
    // Check if it's a localhost or internal IP URL
    const hostname = urlObj.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('10.96.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.')
    ) {
      // Return just the pathname
      return urlObj.pathname;
    }
    
    // For external URLs, return as-is (shouldn't happen for our videos, but just in case)
    return url;
  } catch {
    // If URL parsing fails, assume it's already a relative path or invalid
    // If it starts with /, return as-is, otherwise return null
    return url.startsWith('/') ? url : null;
  }
}

/**
 * Normalize video object URLs
 * 
 * @param video - Video object with downloadUrl and posterUrl
 * @returns Video object with normalized URLs
 */
export function normalizeVideoUrls<T extends { downloadUrl?: string | null; posterUrl?: string | null }>(
  video: T
): T {
  return {
    ...video,
    downloadUrl: normalizeVideoUrl(video.downloadUrl),
    posterUrl: normalizeVideoUrl(video.posterUrl),
  };
}

