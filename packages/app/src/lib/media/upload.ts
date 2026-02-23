/**
 * Upload validation and processing utilities for reference media
 *
 * Handles validation of image and video files for video generation.
 */

import type { FileValidationResult } from '../../types/video';
import { ALLOWED_MIME_TYPES, FILE_SIZE_LIMITS } from '../../types/video';

/**
 * Validate a reference media file (client-side)
 *
 * Checks file type and size before upload.
 */
export function validateReferenceFile(file: File): FileValidationResult {
  const isImage = ALLOWED_MIME_TYPES.IMAGE.includes(file.type as any);
  const isVideo = ALLOWED_MIME_TYPES.VIDEO.includes(file.type as any);

  // Check if file type is allowed
  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: 'Please upload a JPG, PNG, WebP image or MP4, MOV video',
    };
  }

  // Check file size based on type
  const maxSize = isImage ? FILE_SIZE_LIMITS.IMAGE : FILE_SIZE_LIMITS.VIDEO;
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    const fileType = isImage ? 'Image' : 'Video';
    return {
      valid: false,
      error: `${fileType} file too large. Maximum size: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Convert a file to base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Extract file format from MIME type
 */
export function getFormatFromMimeType(mimeType: string): string {
  const format = mimeType.split('/')[1];

  // Handle special cases
  if (format === 'jpeg') return 'jpg';
  if (format === 'quicktime') return 'mov';

  return format;
}

/**
 * Get file type category from MIME type
 */
export function getFileTypeFromMimeType(mimeType: string): 'image' | 'video' {
  return mimeType.startsWith('image/') ? 'image' : 'video';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

const MAX_FILE_SIZE_MB = 100;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function base64DataLengthBytes(base64DataUrl: string): number {
  const parts = base64DataUrl.split(',');
  if (parts.length < 2) return 0;
  const base64 = parts[1] ?? '';

  // Browser-safe size estimation:
  // 1) strip padding
  // 2) bytes = (len * 3) / 4
  const len = base64.replace(/=+$/, '').length;
  return Math.floor((len * 3) / 4);
}

export function validateBase64ReferenceMedia(base64Data: string): { valid: boolean; error: string | null } {
  if (!base64Data.startsWith('data:')) {
    return { valid: false, error: 'Invalid base64 data: must be a data URL' };
  }

  const fileSize = base64DataLengthBytes(base64Data);
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit` };
  }

  return { valid: true, error: null };
}

/**
 * Create a preview URL from a file
 */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke a preview URL to free memory
 */
export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}










