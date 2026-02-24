'use client';

/**
 * VideoCard Component
 *
 * Displays a video with status, expiration, and action buttons.
 */

import { useState } from 'react';
import { VideoExpirationBadge } from './VideoExpirationBadge';
import { VideoPlayerModal } from './VideoPlayerModal';
import { VideoRemixModal } from './VideoRemixModal';
import { useBusiboxApi, useCrossAppBasePath } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';
import { STATUS_LABELS, STATUS_BADGE_CLASSES, RESOLUTION_LABELS, VideoStatus, type VideoWithOwner } from '../../types/video';

interface VideoCardProps {
  video: VideoWithOwner;
  onDelete?: (videoId: string) => void;
  onShare?: (videoId: string) => void;
  onRetryStorage?: (videoId: string) => Promise<void>;
  onCancel?: (videoId: string) => Promise<void>;
  onResubmit?: (videoId: string) => Promise<void>;
  onCheckStatus?: (videoId: string) => Promise<void>;
  onRegeneratePoster?: (videoId: string, timestampSeconds?: number) => Promise<void>;
  onRemix?: (videoId: string, remixPrompt: string) => Promise<void>;
  showOwner?: boolean;
  isOwner: boolean;
}

export function VideoCard({
  video,
  onDelete,
  onShare,
  onRetryStorage,
  onCancel,
  onResubmit,
  onCheckStatus,
  onRegeneratePoster,
  onRemix,
  showOwner = false,
  isOwner,
}: VideoCardProps) {
  const api = useBusiboxApi();
  const mediaBasePath = useCrossAppBasePath('media');

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRetryingStorage, setIsRetryingStorage] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isRegeneratingPoster, setIsRegeneratingPoster] = useState(false);
  const [showRemixModal, setShowRemixModal] = useState(false);
  const [remixReferenceMedia, setRemixReferenceMedia] = useState<typeof video.referenceMedia | null>(null);
  const [posterImageError, setPosterImageError] = useState(false);

  const handleDownload = () => {
    if (video.downloadUrl) {
      const urlMatch = video.downloadUrl.match(/\/api\/videos\/files\/([^/?]+)/);
      if (urlMatch) {
        const fileId = urlMatch[1];
        const base = mediaBasePath.replace(/\/+$/, '');
        const link = document.createElement('a');
        link.href = `${base}/api/videos/files/${fileId}`;
        link.download = `${video.prompt.substring(0, 50)}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(video.downloadUrl, '_blank');
      }
    }
  };

  const handleRetryStorage = async () => {
    if (!onRetryStorage) return;
    setIsRetryingStorage(true);
    try {
      await onRetryStorage(video.id);
    } catch (error) {
      console.error('Failed to retry storage:', error);
    } finally {
      setIsRetryingStorage(false);
    }
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    setIsCancelling(true);
    try {
      await onCancel(video.id);
    } catch (error) {
      console.error('Failed to cancel video:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleResubmit = async () => {
    if (!onResubmit) return;
    setIsResubmitting(true);
    try {
      await onResubmit(video.id);
    } catch (error) {
      console.error('Failed to resubmit video:', error);
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!onCheckStatus) return;
    setIsCheckingStatus(true);
    try {
      await onCheckStatus(video.id);
    } catch (error) {
      console.error('Failed to check status:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleRegeneratePoster = async (timestampSeconds?: number) => {
    if (!onRegeneratePoster) return;
    setIsRegeneratingPoster(true);
    try {
      await onRegeneratePoster(video.id, timestampSeconds);
    } catch (error) {
      console.error('Failed to regenerate poster:', error);
    } finally {
      setIsRegeneratingPoster(false);
    }
  };

  const handleSelectFrame = async (timestampSeconds: number) => {
    await handleRegeneratePoster(timestampSeconds);
  };

  const handleRemix = async (remixPrompt: string) => {
    if (!onRemix) return;
    await onRemix(video.id, remixPrompt);
  };

  const handleOpenRemixModal = async () => {
    if (video.referenceMedia) {
      try {
        const endpoint = `/api/videos/${video.id}`;
        const baseUrl = api.services?.videoApiUrl ?? api.services?.agentApiUrl;

        const response = await fetchServiceFirstFallbackNext({
          service: { baseUrl, path: endpoint, init: { method: 'GET' } },
          next: { nextApiBasePath: mediaBasePath, path: endpoint, init: { method: 'GET' } },
          fallback: {
            fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
            fallbackStatuses: [
              ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
              401,
              403,
            ],
          },
          serviceHeaders: api.serviceRequestHeaders,
        });

        if (!response.ok) throw new Error('Failed to fetch video for remix');

        const data = await response.json();
        if (data.success && data.video?.referenceMedia) {
          setRemixReferenceMedia(data.video.referenceMedia as any);
        } else {
          setRemixReferenceMedia(video.referenceMedia);
        }
      } catch (err) {
        console.error('Failed to fetch video for remix:', err);
        setRemixReferenceMedia(video.referenceMedia);
      }
    } else {
      setRemixReferenceMedia(null);
    }
    setShowRemixModal(true);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(video.id);
    } catch (error) {
      console.error('Delete failed:', error);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const isCompleted = video.status === VideoStatus.COMPLETED;
  const isProcessing = [VideoStatus.QUEUED, VideoStatus.PENDING, VideoStatus.PROCESSING].includes(video.status);
  const isFailed = video.status === VideoStatus.FAILED;
  const isExpired = video.status === VideoStatus.EXPIRED;
  const canCancel = isProcessing && isOwner && onCancel;
  const canResubmit = (isFailed || isExpired) && isOwner && onResubmit;
  const canCheckStatus = isProcessing && isOwner && onCheckStatus;
  const canRemix = isCompleted && isOwner && onRemix;

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
        <div
          className="relative aspect-video bg-gray-100 flex items-center justify-center cursor-pointer"
          onClick={() => {
            if (isCompleted && video.downloadUrl) setIsModalOpen(true);
          }}
        >
          {isCompleted && video.downloadUrl ? (
            <>
              {video.posterUrl && !posterImageError ? (
                <>
                  <img
                    src={video.posterUrl}
                    alt={video.prompt}
                    className="w-full h-full object-cover"
                    onError={() => {
                      console.warn(`[VideoCard] Poster image failed to load: ${video.posterUrl}`);
                      setPosterImageError(true);
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="bg-white bg-opacity-90 rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                      <svg className="h-8 w-8 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <video
                    src={video.downloadUrl}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                    loop
                    preload="metadata"
                    onMouseOver={(e) => {
                      const videoEl = e.target as HTMLVideoElement;
                      videoEl.currentTime = 0;
                      videoEl.play().catch(() => {});
                    }}
                    onMouseOut={(e) => {
                      const videoEl = e.target as HTMLVideoElement;
                      videoEl.pause();
                      videoEl.currentTime = 0;
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="bg-white bg-opacity-90 rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                      <svg className="h-8 w-8 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : isProcessing ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          ) : isFailed ? (
            <svg className="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : isExpired ? (
            <svg className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}

          {isProcessing && video.progress !== null && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
              <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${video.progress}%` }} />
            </div>
          )}

          {video.referenceMedia && (
            <div className="absolute top-2 left-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {video.referenceMedia.fileType === 'image' ? '🖼️' : '🎬'} Reference
              </span>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[video.status]}`}>
              {STATUS_LABELS[video.status]}
            </span>
            {video.expiresAt && !(video.downloadUrl && video.posterUrl) && <VideoExpirationBadge expiresAt={new Date(video.expiresAt)} />}
            {video.downloadUrl && video.posterUrl && (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                title="Video is permanently stored"
              >
                <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Stored
              </span>
            )}
          </div>

          <p className="text-sm text-gray-900 font-medium line-clamp-2 mb-2" title={video.prompt}>
            {video.prompt}
          </p>

          <div className="space-y-1 text-xs text-gray-500 mb-3">
            <div className="flex items-center gap-2">
              <span>{video.durationSeconds}s</span>
              <span>•</span>
              <span>{(RESOLUTION_LABELS as any)[video.resolution] || video.resolution}</span>
            </div>

            {showOwner && (
              <div className="flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{video.owner.email}</span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{new Date(video.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="flex items-center gap-1">
              {video.visibility === 'PRIVATE' ? (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <span>Private</span>
                </>
              ) : video.visibility === 'PUBLIC' ? (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002 2h2.945M15 15v.05M9 20v.05M15 3v.05M9 3v.05M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
                    />
                  </svg>
                  <span>Public</span>
                </>
              ) : video.visibility === 'SHARED' ? (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <span>
                    Shared with {video.shareCount} {video.shareCount === 1 ? 'user' : 'users'}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {isFailed && video.errorMessage && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">{video.errorMessage}</div>}

          {isCompleted && !video.downloadUrl && video.errorMessage && String(video.errorMessage).includes('storage failed') && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 text-amber-800">
                  <p className="font-medium mb-1">Storage Failed</p>
                  <p>{video.errorMessage}</p>
                </div>
                {isOwner && onRetryStorage && (
                  <button
                    onClick={handleRetryStorage}
                    disabled={isRetryingStorage}
                    className="px-3 py-1 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                    title="Retry downloading and storing the video"
                  >
                    {isRetryingStorage ? (
                      <>
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Retrying...
                      </>
                    ) : (
                      <>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Retry Storage
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {isCompleted && video.downloadUrl && (!video.posterUrl || posterImageError) && isOwner && onRegeneratePoster && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 text-blue-800">
                  <p className="font-medium mb-1">Thumbnail Missing or Invalid</p>
                  <p>
                    {posterImageError ? 'The thumbnail image failed to load.' : "This video doesn't have a thumbnail image."} Click the button to
                    generate one from the video.
                  </p>
                </div>
                <button
                  onClick={() => handleRegeneratePoster()}
                  disabled={isRegeneratingPoster}
                  className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                  title="Generate thumbnail image from video"
                >
                  {isRegeneratingPoster ? (
                    <>
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Generate Thumbnail
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {canCheckStatus && (
              <button
                onClick={handleCheckStatus}
                disabled={isCheckingStatus}
                className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Check current status and progress from OpenAI"
              >
                {isCheckingStatus ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Checking...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Check Status
                  </>
                )}
              </button>
            )}

            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="px-3 py-2 bg-red-100 text-red-700 text-sm font-medium rounded hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Cancel video generation"
              >
                {isCancelling ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Cancelling...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </>
                )}
              </button>
            )}

            {canResubmit && (
              <button
                onClick={handleResubmit}
                disabled={isResubmitting}
                className="px-3 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Resubmit video generation with same parameters"
              >
                {isResubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Resubmitting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Resubmit
                  </>
                )}
              </button>
            )}

            {canRemix && (
              <button
                onClick={handleOpenRemixModal}
                className="px-3 py-2 bg-purple-100 text-purple-700 text-sm font-medium rounded hover:bg-purple-200 transition-colors flex items-center gap-1"
                title="Create a remix with modified prompt"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Remix
              </button>
            )}

            {isCompleted && video.downloadUrl && (
              <button
                onClick={handleDownload}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            )}

            {isOwner && isCompleted && onShare && (
              <button
                onClick={() => onShare(video.id)}
                className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors"
                title="Share video"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </button>
            )}

            {isOwner && onDelete && !showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-red-100 hover:text-red-700 transition-colors"
                title="Delete video"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}

            {showDeleteConfirm && (
              <>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && video.downloadUrl && (
        <VideoPlayerModal
          videoUrl={video.downloadUrl}
          videoId={isOwner && onRegeneratePoster ? video.id : undefined}
          onClose={() => setIsModalOpen(false)}
          onSelectFrame={isOwner && onRegeneratePoster ? handleSelectFrame : undefined}
        />
      )}

      {showRemixModal && (
        <VideoRemixModal
          isOpen={showRemixModal}
          onClose={() => {
            setShowRemixModal(false);
            setRemixReferenceMedia(null);
          }}
          originalPrompt={video.prompt}
          referenceMedia={remixReferenceMedia}
          onRemix={handleRemix}
        />
      )}
    </>
  );
}










