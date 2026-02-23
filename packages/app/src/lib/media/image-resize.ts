/**
 * Image Resizing Utilities for Video Reference Images
 * 
 * Resizes reference images to match the video resolution before passing to OpenAI.
 * OpenAI requires reference images to match the video resolution exactly.
 */

/**
 * Parse video resolution string to width and height
 * 
 * @param resolution - Resolution string like "1920x1080" or "1080x1920"
 * @returns Object with width and height, or null if invalid
 */
export function parseResolution(resolution: string): { width: number; height: number } | null {
  const match = resolution.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return null;
  }
  
  return {
    width: parseInt(match[1], 10),
    height: parseInt(match[2], 10),
  };
}

/**
 * Convert base64 data URL to File object
 * 
 * @param base64Data - Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @param filename - Optional filename for the File object
 * @returns File object
 */
export function base64ToFile(base64Data: string, filename: string = 'reference-image.jpg'): File {
  // Extract base64 data and mime type
  const base64Match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid base64 data URL format');
  }

  const [, format, base64String] = base64Match;
  const imageBuffer = Buffer.from(base64String, 'base64');
  
  // Determine MIME type
  const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
  
  // Create File object from buffer
  // Node.js 18+ has File available globally
  // The OpenAI SDK expects a File object (which extends Blob) for multipart/form-data uploads
  if (typeof File === 'undefined') {
    throw new Error('File API not available. Requires Node.js 18+ or newer.');
  }
  
  return new File([imageBuffer], filename, { type: mimeType });
}

/**
 * Resize a base64 image to match video resolution
 * 
 * @param base64Data - Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @param targetWidth - Target width in pixels
 * @param targetHeight - Target height in pixels
 * @returns Promise resolving to resized base64 data URL
 */
export async function resizeBase64Image(
  base64Data: string,
  targetWidth: number,
  targetHeight: number
): Promise<string> {
  try {
    // Dynamic import of sharp (may not be available in all environments)
    const sharp = await import('sharp').catch(() => null);
    
    if (!sharp) {
      console.warn('[IMAGE RESIZE] sharp not available, returning original image');
      return base64Data;
    }

    // Extract base64 data (remove data URL prefix)
    const base64Match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid base64 data URL format');
    }

    const [, format, base64String] = base64Match;
    const imageBuffer = Buffer.from(base64String, 'base64');

    // Resize image to match video resolution
    // Using 'cover' fit to fill the entire area (may crop)
    // Using 'contain' would preserve aspect ratio but may add padding
    const resizedBuffer = await sharp.default(imageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'cover', // Fill the entire area, may crop edges
        position: 'center', // Center the image when cropping
      })
      .toBuffer();

    // Convert back to base64 data URL
    const resizedBase64 = resizedBuffer.toString('base64');
    const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
    
    return `data:${mimeType};base64,${resizedBase64}`;
  } catch (error) {
    console.error('[IMAGE RESIZE] Failed to resize image:', error);
    // Return original if resize fails
    return base64Data;
  }
}

/**
 * Resize reference image to match video resolution
 * 
 * @param base64Data - Base64 data URL of the reference image
 * @param videoResolution - Video resolution string (e.g., "1920x1080")
 * @returns Promise resolving to resized base64 data URL
 */
export async function resizeReferenceImage(
  base64Data: string,
  videoResolution: string
): Promise<string> {
  const resolution = parseResolution(videoResolution);
  
  if (!resolution) {
    console.warn(`[IMAGE RESIZE] Invalid resolution format: ${videoResolution}, returning original`);
    return base64Data;
  }

  return resizeBase64Image(base64Data, resolution.width, resolution.height);
}

