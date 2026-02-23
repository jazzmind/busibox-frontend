/**
 * Shared TypeScript types for Enhanced Video Generation
 * 
 * These types align with:
 * - OpenAPI spec: contracts/videos.openapi.yaml
 * - Prisma schema: data-model.md
 * - Database schema: prisma/schema.prisma
 * 
 * Use these types throughout the frontend and backend for type safety.
 */

import type { ReactNode } from 'react'

// ============================================================================
// LEGACY TYPES (for compatibility with existing video page)
// ============================================================================

/**
 * Legacy OpenAI video job type
 * Used by existing video generation page
 */
export interface VideoJob {
  id: string
  status: string
  progress?: number
  model: string
  created_at: number
  seconds?: number
  size?: string
  error?: {
    message: string
  }
}

/**
 * Legacy video metadata type
 * Stored in localStorage for video titles
 */
export interface VideoMetadata {
  id: string
  prompt: string
  title: string
  generatedAt: number
}

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Video generation lifecycle state
 */
export enum VideoStatus {
  /** Initial state when submitted */
  QUEUED = 'QUEUED',
  /** OpenAI accepted, waiting to start */
  PENDING = 'PENDING',
  /** Currently generating */
  PROCESSING = 'PROCESSING',
  /** Ready with download URL */
  COMPLETED = 'COMPLETED',
  /** Generation failed with error */
  FAILED = 'FAILED',
  /** Beyond OpenAI retention period */
  EXPIRED = 'EXPIRED'
}

/**
 * Access control level for videos
 */
export enum VideoVisibility {
  /** Only owner can access */
  PRIVATE = 'PRIVATE',
  /** All authenticated users can access */
  PUBLIC = 'PUBLIC',
  /** Specific users can access */
  SHARED = 'SHARED'
}

/**
 * Type of reference media uploaded
 */
export enum ReferenceMediaType {
  IMAGE = 'image',
  VIDEO = 'video'
}

/**
 * Supported file formats for reference media
 */
export enum ReferenceMediaFormat {
  JPG = 'jpg',
  PNG = 'png',
  WEBP = 'webp',
  MP4 = 'mp4',
  MOV = 'mov'
}

// ============================================================================
// DATABASE MODELS (Core entities from Prisma)
// ============================================================================

/**
 * Video record from database
 */
export interface Video {
  id: string
  ownerId: string
  openaiVideoId: string | null
  prompt: string
  durationSeconds: 4 | 8 | 12
  resolution: string
  status: VideoStatus
  visibility: VideoVisibility
  createdAt: Date
  completedAt: Date | null
  expiresAt: Date | null
  openaiModel: string | null
  downloadUrl: string | null
  posterUrl: string | null
  progress: number | null
  errorMessage: string | null
}

/**
 * Video share relationship
 */
export interface VideoShare {
  id: string
  videoId: string
  userId: string
  sharedBy: string
  sharedAt: Date
}

/**
 * Reference media metadata
 */
export interface VideoReferenceMedia {
  id: string
  videoId: string
  fileType: ReferenceMediaType
  format: ReferenceMediaFormat
  fileSizeBytes: number
  base64Data: string
  uploadedAt: Date
}

// ============================================================================
// API REQUEST TYPES
// ============================================================================

/**
 * Request to generate a new video
 */
export interface VideoGenerationRequest {
  /** Text description of the video to generate */
  prompt: string
  /** Video duration: must be 4, 8, or 12 seconds */
  durationSeconds: 4 | 8 | 12
  /** Video resolution */
  resolution: '1920x1080' | '1280x720' | '1080x1920' | '720x1280' | '1080x1080'
  /** Optional reference media for enhanced generation */
  referenceMedia?: ReferenceMediaUpload
}

/**
 * Reference media upload data
 */
export interface ReferenceMediaUpload {
  /** Base64-encoded file with data URL prefix */
  base64: string
  /** Type of media */
  fileType: ReferenceMediaType
  /** File format */
  format: ReferenceMediaFormat
  /** Original file size in bytes */
  fileSizeBytes: number
}

/**
 * Request to update video sharing settings
 */
export interface VideoSharingRequest {
  /** New visibility level */
  visibility: VideoVisibility
  /** User IDs to share with (required when visibility is SHARED) */
  userIds?: string[]
}

/**
 * Query parameters for listing videos
 */
export interface VideoListQuery {
  /** Filter videos by access type */
  filter?: 'my-videos' | 'public' | 'shared'
  /** Filter by generation status */
  status?: VideoStatus
  /** Show only videos expiring within 48 hours */
  expiringOnly?: boolean
  /** Number of videos to return */
  limit?: number
  /** Number of videos to skip (for pagination) */
  offset?: number
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Standard success response wrapper
 */
export interface ApiResponse<T> {
  success: true
  data: T
}

/**
 * Standard error response
 */
export interface ApiError {
  success: false
  error: string
  code?: string
  details?: Record<string, unknown>
}

/**
 * Validation error details
 */
export interface ValidationError extends ApiError {
  validationErrors: Array<{
    field: string
    message: string
  }>
}

/**
 * Video with owner information
 */
export interface VideoWithOwner extends Video {
  owner: {
    email: string
  }
  /** Number of users this video is shared with */
  shareCount: number
  /** Reference media info (if any) */
  referenceMedia?: ReferenceMediaInfo | null
}

/**
 * Video with share details
 */
export interface VideoWithShares extends VideoWithOwner {
  shares: VideoShareWithUser[]
}

/**
 * Video share with user details
 */
export interface VideoShareWithUser {
  id: string
  videoId: string
  userId: string
  sharedBy: string
  sharedAt: Date
  user: {
    id: string
    email: string
  }
  sharer: {
    id: string
    email: string
  }
}

/**
 * Reference media info (without base64 data)
 */
export interface ReferenceMediaInfo {
  id: string
  fileType: ReferenceMediaType
  format: ReferenceMediaFormat
  fileSizeBytes: number
  uploadedAt: Date
}

/**
 * Video sharing details
 */
export interface VideoSharingDetails {
  videoId: string
  visibility: VideoVisibility
  shareCount: number
  shares?: VideoShareWithUser[]
}

/**
 * Pagination metadata
 */
export interface Pagination {
  /** Total number of items matching filter */
  total: number
  /** Number of items returned in this response */
  limit: number
  /** Number of items skipped */
  offset: number
  /** Whether more items are available */
  hasMore: boolean
}

/**
 * Paginated list of videos
 */
export interface VideoListResponse {
  success: true
  videos: VideoWithOwner[]
  pagination: Pagination
}

/**
 * Single video response
 */
export interface VideoResponse {
  success: true
  video: VideoWithOwner
}

/**
 * Video generation response
 */
export interface VideoGenerationResponse {
  success: true
  video: Video
}

/**
 * Video sharing response
 */
export interface VideoSharingResponse {
  success: true
  video: VideoWithShares
}

/**
 * Video deletion response
 */
export interface VideoDeletionResponse {
  success: true
  deleted: {
    id: string
  }
}

// ============================================================================
// CLIENT-SIDE UTILITY TYPES
// ============================================================================

/**
 * Video expiration status for UI display
 */
export interface VideoExpirationStatus {
  /** Status category */
  status: 'active' | 'expires-soon' | 'expired'
  /** Severity for UI styling */
  severity: 'normal' | 'warning' | 'critical'
  /** Hours remaining until expiration (null if expired) */
  hoursRemaining: number | null
  /** Days remaining (rounded) */
  daysRemaining: number | null
  /** Human-readable label */
  label: string
  /** CSS class for badge styling */
  badgeClass: string
}

/**
 * Video library filter options
 */
export type VideoLibraryFilter = 'my-videos' | 'public' | 'shared'

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean
  error?: string
}

/**
 * Upload progress state
 */
export interface UploadProgress {
  uploading: boolean
  progress: number
  error?: string
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if response is an error
 */
export function isApiError(response: unknown): response is ApiError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false &&
    'error' in response
  )
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return (
    isApiError(error) &&
    'validationErrors' in error &&
    Array.isArray((error as ValidationError).validationErrors)
  )
}

/**
 * Check if video is in terminal state (won't change)
 */
export function isTerminalStatus(status: VideoStatus): boolean {
  return [
    VideoStatus.COMPLETED,
    VideoStatus.FAILED,
    VideoStatus.EXPIRED
  ].includes(status)
}

/**
 * Check if video is actively being processed
 */
export function isActiveStatus(status: VideoStatus): boolean {
  return [
    VideoStatus.QUEUED,
    VideoStatus.PENDING,
    VideoStatus.PROCESSING
  ].includes(status)
}

/**
 * Check if file type is valid for reference media
 */
export function isValidReferenceMediaType(mimeType: string): boolean {
  return [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime'
  ].includes(mimeType)
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Allowed video durations in seconds
 */
export const ALLOWED_DURATIONS = [4, 8, 12] as const
export type AllowedDuration = typeof ALLOWED_DURATIONS[number]

/**
 * Allowed video resolutions
 */
export const ALLOWED_RESOLUTIONS = [
  '1920x1080',
  '1280x720',
  '1080x1920',
  '720x1280',
  '1080x1080'
] as const
export type AllowedResolution = typeof ALLOWED_RESOLUTIONS[number]

/**
 * File size limits
 */
export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  VIDEO: 25 * 1024 * 1024  // 25MB
} as const

/**
 * Allowed MIME types for uploads
 */
export const ALLOWED_MIME_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  VIDEO: ['video/mp4', 'video/quicktime']
} as const

/**
 * OpenAI video retention period (days)
 */
export const OPENAI_RETENTION_DAYS = 7

/**
 * Expiration warning thresholds (hours)
 */
export const EXPIRATION_THRESHOLDS = {
  CRITICAL: 24,  // < 24 hours: red badge
  WARNING: 48    // < 48 hours: orange badge
} as const

/**
 * Polling intervals (milliseconds)
 */
export const POLL_INTERVALS = {
  QUEUED: 2000,      // 2 seconds
  PENDING: 3000,     // 3 seconds
  PROCESSING: 5000,  // 5 seconds
  LIBRARY: 5000      // 5 seconds for library page
} as const

/**
 * Resolution display labels
 */
export const RESOLUTION_LABELS: Record<AllowedResolution, string> = {
  '1920x1080': 'Full HD (1920×1080)',
  '1280x720': 'HD (1280×720)',
  '1080x1920': 'Vertical Full HD (1080×1920)',
  '720x1280': 'Vertical HD (720×1280)',
  '1080x1080': 'Square (1080×1080)'
}

/**
 * Status display labels
 */
export const STATUS_LABELS: Record<VideoStatus, string> = {
  [VideoStatus.QUEUED]: 'Queued',
  [VideoStatus.PENDING]: 'Pending',
  [VideoStatus.PROCESSING]: 'Processing',
  [VideoStatus.COMPLETED]: 'Completed',
  [VideoStatus.FAILED]: 'Failed',
  [VideoStatus.EXPIRED]: 'Expired'
}

/**
 * Status badge CSS classes (Tailwind)
 */
export const STATUS_BADGE_CLASSES: Record<VideoStatus, string> = {
  [VideoStatus.QUEUED]: 'bg-yellow-100 text-yellow-800',
  [VideoStatus.PENDING]: 'bg-blue-100 text-blue-800',
  [VideoStatus.PROCESSING]: 'bg-blue-100 text-blue-800',
  [VideoStatus.COMPLETED]: 'bg-green-100 text-green-800',
  [VideoStatus.FAILED]: 'bg-red-100 text-red-800',
  [VideoStatus.EXPIRED]: 'bg-gray-100 text-gray-800'
}

/**
 * Visibility display labels
 */
export const VISIBILITY_LABELS: Record<VideoVisibility, string> = {
  [VideoVisibility.PRIVATE]: 'Private',
  [VideoVisibility.PUBLIC]: 'Public',
  [VideoVisibility.SHARED]: 'Shared'
}

// ============================================================================
// LEGACY / DASHBOARD TYPES
// ============================================================================

/**
 * Application card interface (preserved from existing types)
 */
export interface ApplicationCard {
  name: string
  description: string
  url: string
  comingSoon: boolean
  isInternal?: boolean
  icon: ReactNode
}
