/**
 * Shared TypeScript types for video UI and client-side helpers.
 *
 * NOTE: This file intentionally avoids Prisma types. It models API payloads and UI needs.
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum VideoStatus {
  QUEUED = 'QUEUED',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum VideoVisibility {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
  SHARED = 'SHARED',
}

export enum ReferenceMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum ReferenceMediaFormat {
  JPG = 'jpg',
  PNG = 'png',
  WEBP = 'webp',
  MP4 = 'mp4',
  MOV = 'mov',
}

// ============================================================================
// CORE ENTITIES (API payload shapes)
// ============================================================================

export interface Video {
  id: string;
  ownerId: string;
  openaiVideoId: string | null;
  prompt: string;
  durationSeconds: 4 | 8 | 12;
  resolution: string;
  status: VideoStatus;
  visibility: VideoVisibility;
  createdAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  openaiModel: string | null;
  downloadUrl: string | null;
  posterUrl: string | null;
  progress: number | null;
  errorMessage: string | null;
}

export interface ReferenceMediaUpload {
  base64: string;
  fileType: ReferenceMediaType;
  format: ReferenceMediaFormat;
  fileSizeBytes: number;
}

export interface ReferenceMediaInfo {
  id: string;
  fileType: ReferenceMediaType;
  format: ReferenceMediaFormat;
  fileSizeBytes: number;
  uploadedAt: Date;
}

export interface VideoShareWithUser {
  id: string;
  videoId: string;
  userId: string;
  sharedBy: string;
  sharedAt: Date;
  user: { id: string; email: string };
  sharer: { id: string; email: string };
}

export interface VideoWithOwner extends Video {
  owner: { email: string };
  shareCount: number;
  referenceMedia?: ReferenceMediaInfo | null;
}

export interface VideoWithShares extends VideoWithOwner {
  shares: VideoShareWithUser[];
}

// ============================================================================
// UI / VALIDATION TYPES
// ============================================================================

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export type VideoExpirationStatus = {
  status: 'active' | 'expires-soon' | 'expired';
  severity: 'normal' | 'warning' | 'critical';
  hoursRemaining: number | null;
  daysRemaining: number | null;
  label: string;
  badgeClass: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const ALLOWED_DURATIONS = [4, 8, 12] as const;
export type AllowedDuration = (typeof ALLOWED_DURATIONS)[number];

export const ALLOWED_RESOLUTIONS = [
  '1920x1080',
  '1280x720',
  '1080x1920',
  '720x1280',
  '1080x1080',
] as const;
export type AllowedResolution = (typeof ALLOWED_RESOLUTIONS)[number];

export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024,
  VIDEO: 25 * 1024 * 1024,
} as const;

export const ALLOWED_MIME_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  VIDEO: ['video/mp4', 'video/quicktime'],
} as const;

export const OPENAI_RETENTION_DAYS = 7;

export const EXPIRATION_THRESHOLDS = {
  CRITICAL: 24,
  WARNING: 48,
} as const;

export const RESOLUTION_LABELS: Record<AllowedResolution, string> = {
  '1920x1080': 'Full HD (1920×1080)',
  '1280x720': 'HD (1280×720)',
  '1080x1920': 'Vertical Full HD (1080×1920)',
  '720x1280': 'Vertical HD (720×1280)',
  '1080x1080': 'Square (1080×1080)',
};

export const STATUS_LABELS: Record<VideoStatus, string> = {
  [VideoStatus.QUEUED]: 'Queued',
  [VideoStatus.PENDING]: 'Pending',
  [VideoStatus.PROCESSING]: 'Processing',
  [VideoStatus.COMPLETED]: 'Completed',
  [VideoStatus.FAILED]: 'Failed',
  [VideoStatus.EXPIRED]: 'Expired',
};

export const STATUS_BADGE_CLASSES: Record<VideoStatus, string> = {
  [VideoStatus.QUEUED]: 'bg-yellow-100 text-yellow-800',
  [VideoStatus.PENDING]: 'bg-blue-100 text-blue-800',
  [VideoStatus.PROCESSING]: 'bg-blue-100 text-blue-800',
  [VideoStatus.COMPLETED]: 'bg-green-100 text-green-800',
  [VideoStatus.FAILED]: 'bg-red-100 text-red-800',
  [VideoStatus.EXPIRED]: 'bg-gray-100 text-gray-800',
};










