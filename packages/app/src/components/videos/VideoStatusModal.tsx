'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBusiboxApi } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';
import { VideoStatus } from '../../types/video';

interface VideoStatusInfo {
  id: string;
  status: VideoStatus;
  progress: number | null;
  openaiVideoId: string | null;
  prompt: string;
  duration: number;
  resolution: string;
  createdAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
  downloadUrl: string | null;
  posterUrl: string | null;
}

interface VideoStatusModalProps {
  videoId: string;
  onClose: () => void;
}

export function VideoStatusModal({ videoId, onClose }: VideoStatusModalProps) {
  const api = useBusiboxApi();

  const [status, setStatus] = useState<VideoStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    fetchStatus();
    return () => {
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = `/api/videos/${videoId}/status`;
      const baseUrl = api.services?.videoApiUrl ?? api.services?.agentApiUrl;

      const response = await fetchServiceFirstFallbackNext({
        service: { baseUrl, path: endpoint, init: { method: 'GET' } },
        next: { nextApiBasePath: api.nextApiBasePath, path: endpoint, init: { method: 'GET' } },
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

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch status');
      }

      const data = await response.json();
      const videoData = data.data?.video || data.video;
      if (data.success && videoData) {
        setStatus(videoData);
      } else {
        setError(data.error || data.data?.error || 'Failed to fetch status');
      }
    } catch (err) {
      console.error('Failed to fetch video status:', err);
      setError('An error occurred while fetching status');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (s: VideoStatus) => {
    switch (s) {
      case VideoStatus.COMPLETED:
        return 'text-green-600 bg-green-100';
      case VideoStatus.PROCESSING:
        return 'text-blue-600 bg-blue-100';
      case VideoStatus.QUEUED:
        return 'text-yellow-600 bg-yellow-100';
      case VideoStatus.PENDING:
        return 'text-indigo-600 bg-indigo-100';
      case VideoStatus.FAILED:
        return 'text-red-600 bg-red-100';
      case VideoStatus.EXPIRED:
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]" onClick={handleClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Video Status Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading status...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-4">{error}</div>
              <button
                onClick={fetchStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : status ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Status</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.status)}`}>{status.status}</span>
                </div>
                {status.progress !== null && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(0, status.progress || 0))}%` }} />
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Prompt</h3>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{status.prompt}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Created</span>
                  <div className="text-gray-900">{formatDate(status.createdAt)}</div>
                </div>
                <div>
                  <span className="text-gray-500">Completed</span>
                  <div className="text-gray-900">{formatDate(status.completedAt)}</div>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <div className="text-gray-900">{status.duration}s</div>
                </div>
                <div>
                  <span className="text-gray-500">Resolution</span>
                  <div className="text-gray-900">{status.resolution}</div>
                </div>
              </div>

              {status.errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-red-800 mb-1">Error</h3>
                  <p className="text-sm text-red-700">{status.errorMessage}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}










