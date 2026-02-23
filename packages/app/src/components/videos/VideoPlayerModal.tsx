'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface VideoPlayerModalProps {
  videoUrl: string;
  videoId?: string;
  onClose: () => void;
  onSelectFrame?: (timestampSeconds: number) => Promise<void>;
}

export function VideoPlayerModal({ videoUrl, videoId, onClose, onSelectFrame }: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSelectingFrame, setIsSelectingFrame] = useState(false);
  const [showFrameSelection, setShowFrameSelection] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const handleSelectFrame = async () => {
    if (!videoRef.current || !onSelectFrame || isSelectingFrame) return;

    setIsSelectingFrame(true);
    try {
      await onSelectFrame(videoRef.current.currentTime);
      onClose();
    } catch (error) {
      console.error('Failed to select frame:', error);
      alert('Failed to set poster frame. Please try again.');
    } finally {
      setIsSelectingFrame(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Video Preview</h3>
            {videoId && <p className="text-xs text-gray-500">ID: {videoId}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <video ref={videoRef} src={videoUrl} controls className="w-full rounded bg-black max-h-[60vh]" />

          {onSelectFrame && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Poster Frame</h4>
                  <p className="text-xs text-gray-500">Select a timestamp to set as the poster image</p>
                </div>
                <button
                  onClick={() => setShowFrameSelection((s) => !s)}
                  className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  type="button"
                >
                  {showFrameSelection ? 'Hide' : 'Choose Frame'}
                </button>
              </div>

              {showFrameSelection && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="text-sm text-gray-700">
                    Current: <span className="font-mono">{formatTime(currentTime)}</span> /{' '}
                    <span className="font-mono">{formatTime(duration)}</span>
                  </div>
                  <button
                    onClick={handleSelectFrame}
                    disabled={isSelectingFrame}
                    className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    {isSelectingFrame ? 'Setting...' : 'Set Poster Frame'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}










