'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { VideoJob, VideoMetadata } from '@/types/video';
import { VideoStatus, type ReferenceMediaUpload, type VideoWithOwner } from '@jazzmind/busibox-app';
import { ProtectedRoute } from '@jazzmind/busibox-app/components/auth/ProtectedRoute';
import { VideoUpload, VideoCard, VideoShareModal, VideoStatusModal } from '@jazzmind/busibox-app';

type Tab = 'library' | 'generate';

const METADATA_KEY = 'video_metadata';
const POLLING_TIMEOUT = 300000; // 5 minutes

export default function VideosPage() {
  return (
    <ProtectedRoute>
      <VideosPageContent />
    </ProtectedRoute>
  );
}

function VideosPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [libraryVideos, setLibraryVideos] = useState<VideoWithOwner[]>([]);
  const [libraryFilter, setLibraryFilter] = useState<'my-videos' | 'public' | 'shared'>('my-videos');
  const [metadata, setMetadata] = useState<Record<string, VideoMetadata>>({});
  const [selectedVideo, setSelectedVideo] = useState<VideoJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Generate form state
  const [prompt, setPrompt] = useState('');
  const [seconds, setSeconds] = useState(4);
  const [size, setSize] = useState('1280x720');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pollingStartTime, setPollingStartTime] = useState<number | null>(null);
  const [referenceMedia, setReferenceMedia] = useState<any>(null);
  
  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [videoToShare, setVideoToShare] = useState<VideoWithOwner | null>(null);
  
  // Status modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [videoIdForStatus, setVideoIdForStatus] = useState<string | null>(null);

  // Wait for mount before making API calls
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load metadata from localStorage
  useEffect(() => {
    if (!isMounted) return;
    
    const stored = localStorage.getItem(METADATA_KEY);
    if (stored) {
      try {
        setMetadata(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse metadata:', e);
      }
    }
  }, [isMounted]);

  // Save metadata to localStorage
  const saveMetadata = useCallback((meta: Record<string, VideoMetadata>) => {
    localStorage.setItem(METADATA_KEY, JSON.stringify(meta));
    setMetadata(meta);
  }, []);

  // Fetch library videos using new API
  const fetchLibraryVideos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/videos/library?filter=${libraryFilter}&limit=50`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch videos');
      }

      if (data.success && data.videos) {
        setLibraryVideos(data.videos);
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || 'Failed to load videos');
    } finally {
      setIsLoading(false);
    }
  }, [libraryFilter]);

  // Fetch library videos when filter changes or tab becomes active
  useEffect(() => {
    if (!isMounted) return;
    if (activeTab === 'library') {
      fetchLibraryVideos();
    }
  }, [activeTab, libraryFilter, fetchLibraryVideos, isMounted]);

  // Track poll counts for exponential backoff (persists across renders)
  const pollCountsRef = useRef<Map<string, number>>(new Map());
  // Use ref to track current videos for polling (avoids stale closure issues)
  const libraryVideosRef = useRef<VideoWithOwner[]>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    libraryVideosRef.current = libraryVideos;
  }, [libraryVideos]);
  
  // Check if there are videos that need polling
  const hasVideosNeedingPoll = libraryVideos.some(
    v => [VideoStatus.QUEUED, VideoStatus.PENDING, VideoStatus.PROCESSING].includes(v.status as VideoStatus) ||
         (v.status === VideoStatus.COMPLETED && !v.downloadUrl)
  );
  
  // Auto-refresh for pending library videos with exponential backoff
  // Wait 3 seconds initially, then poll with exponential backoff (5s, 10s, 20s, max 60s)
  useEffect(() => {
    // Only poll if we're on the library tab and have videos that need polling
    if (activeTab !== 'library' || !hasVideosNeedingPoll) {
      return;
    }
    
    // Get polling interval with exponential backoff
    const getPollingInterval = (video: VideoWithOwner): number => {
      // Completed videos being stored: poll frequently until stored
      if (video.status === VideoStatus.COMPLETED && !video.downloadUrl) {
        return 3000; // Poll every 3 seconds until storage completes
      }
      
      // Get poll count for this video for exponential backoff
      const pollCount = pollCountsRef.current.get(video.id) || 0;
      
      // Base interval of 5 seconds, double each time, max 60 seconds
      const baseInterval = 5000;
      const interval = Math.min(baseInterval * Math.pow(2, pollCount), 60000);
      
      return interval;
    };
    
    // Check videos and update status
    const checkVideos = async () => {
      const currentVideos = libraryVideosRef.current;

      const videosToCheck = currentVideos.filter(
        v => [VideoStatus.QUEUED, VideoStatus.PENDING, VideoStatus.PROCESSING].includes(v.status as VideoStatus) ||
             (v.status === VideoStatus.COMPLETED && !v.downloadUrl)
      );

      if (videosToCheck.length === 0) {
        console.log('[POLLING] No videos to check');
        return false; // Return false to indicate no more polling needed
      }

      console.log(`[POLLING] Checking ${videosToCheck.length} video(s)`);

      let hasProcessingVideos = false;

      for (const video of videosToCheck) {
        try {
          const response = await fetch(`/api/videos/${video.id}/status`);
          const data = await response.json();
          
          // API response wraps data in { success: true, data: {...} }
          const videoData = data.data?.video || data.video;
          if (data.success && videoData) {
            const oldStatus = video.status;
            const newStatus = videoData.status;
            
            if (oldStatus !== newStatus) {
              console.log(`[POLLING] Video ${video.id} status changed: ${oldStatus} -> ${newStatus}`);
              // Reset poll count on status change
              pollCountsRef.current.set(video.id, 0);
            } else {
              // Increment poll count for backoff
              pollCountsRef.current.set(video.id, (pollCountsRef.current.get(video.id) || 0) + 1);
            }
            
            // Update the video in the list
            setLibraryVideos(prev => 
              prev.map(v => v.id === video.id ? { ...v, ...videoData } : v)
            );
            
            // Check if this video still needs polling
            if ([VideoStatus.QUEUED, VideoStatus.PENDING, VideoStatus.PROCESSING].includes(videoData.status) ||
                (videoData.status === VideoStatus.COMPLETED && !videoData.downloadUrl)) {
              hasProcessingVideos = true;
            }
          }
        } catch (err) {
          console.error(`Failed to poll status for video ${video.id}:`, err);
        }
      }

      return hasProcessingVideos; // Return true if we need to continue polling
    };
    
    let timeoutId: NodeJS.Timeout;
    let isPolling = true;
    
    const scheduleNextPoll = () => {
      if (!isPolling) return;
      
      const currentVideos = libraryVideosRef.current;

      const videosToCheck = currentVideos.filter(
        v => [VideoStatus.QUEUED, VideoStatus.PENDING, VideoStatus.PROCESSING].includes(v.status as VideoStatus) ||
             (v.status === VideoStatus.COMPLETED && !v.downloadUrl)
      );
      
      if (videosToCheck.length === 0) {
        console.log('[POLLING] No videos need polling, stopping');
        return;
      }
      
      // Find the shortest interval needed (considering backoff)
      const minInterval = Math.min(
        ...videosToCheck.map(v => getPollingInterval(v))
      );
      
      console.log(`[POLLING] Next poll in ${minInterval}ms for ${videosToCheck.length} video(s)`);
      
      timeoutId = setTimeout(async () => {
        const shouldContinue = await checkVideos();
        if (shouldContinue) {
          scheduleNextPoll();
        }
      }, minInterval);
    };
    
    // Wait 3 seconds before first poll, then start polling loop
    console.log('[POLLING] Starting polling in 3 seconds...');
    const initialDelay = setTimeout(async () => {
      if (!isPolling) return;
      
      console.log('[POLLING] Initial poll after 3 second delay');
      
      const shouldContinue = await checkVideos();
      if (shouldContinue) {
        // Start polling loop for processing videos
        scheduleNextPoll();
      }
    }, 3000);

    return () => {
      isPolling = false;
      clearTimeout(initialDelay);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeTab, hasVideosNeedingPoll]);

  const generateTitle = async (videoPrompt: string): Promise<string> => {
    try {
      const response = await fetch('/api/videos/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: videoPrompt }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return data.title;
      }
    } catch (e) {
      console.error('Failed to generate title:', e);
    }
    return 'Untitled Video';
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setPollingStartTime(Date.now());

    try {
      console.log('[VIDEO GENERATE] Starting video generation...');
      const response = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          seconds,
          size,
          referenceMedia: referenceMedia || undefined,
        }),
      });

      const data = await response.json();
      // API response wraps data in { success: true, data: {...} }
      const responseData = data.data || data;
      console.log('[VIDEO GENERATE] Response received:', { ok: response.ok, status: response.status, success: data.success, hasVideo: !!responseData.video, videoId: responseData.video?.id });

      if (!response.ok) {
        console.error('[VIDEO GENERATE] API error:', data);
        throw new Error(data.error || responseData.error || 'Failed to generate video');
      }

      if (data.success && responseData.video) {
        // Save prompt before clearing (needed for title generation)
        const savedPrompt = prompt.trim();
        const videoId = responseData.video.id;
        
        // Clear form immediately
        setPrompt('');
        setReferenceMedia(null);

        // Switch to library tab immediately
        console.log('[VIDEO GENERATE] Switching to library tab');
        setActiveTab('library');
        
        // Wait a moment for the tab switch to render, then fetch videos
        setTimeout(async () => {
          console.log('[VIDEO GENERATE] Fetching library videos...');
          try {
            await fetchLibraryVideos();
            console.log('[VIDEO GENERATE] Library videos fetched successfully');
            
            // Find and select the new video
            setLibraryVideos(currentVideos => {
              const newVideo = currentVideos.find(v => v.id === videoId);
              if (newVideo) {
                console.log('[VIDEO GENERATE] Found new video in library, selecting it');
                setSelectedVideo(newVideo as any);
              } else {
                console.warn('[VIDEO GENERATE] New video not found in library yet');
              }
              return currentVideos;
            });
          } catch (fetchError) {
            console.error('[VIDEO GENERATE] Failed to fetch library:', fetchError);
          } finally {
            // Re-enable button after library is fetched
            setIsGenerating(false);
          }
        }, 500);
        
        // Generate title in the background and update metadata
        generateTitle(savedPrompt).then(title => {
          const newMetadata = {
            ...metadata,
            [videoId]: {
              id: videoId,
              prompt: savedPrompt,
              title,
              generatedAt: Date.now(),
            },
          };
          saveMetadata(newMetadata);
        }).catch(err => {
          console.error('[VIDEO GENERATE] Failed to generate title:', err);
          // Still save metadata without title
          const newMetadata = {
            ...metadata,
            [videoId]: {
              id: videoId,
              prompt: savedPrompt,
              title: 'Untitled Video',
              generatedAt: Date.now(),
            },
          };
          saveMetadata(newMetadata);
        });
      } else {
        console.error('[VIDEO GENERATE] Unexpected response format:', data);
        throw new Error('Unexpected response from server');
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error('[VIDEO GENERATE] Error:', error);
      setError(error.message || 'An error occurred while generating the video');
      setPollingStartTime(null);
      setIsGenerating(false); // Re-enable button on error
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) {
      return;
    }

    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete video');
      }

      // Remove from both lists
      setLibraryVideos(prev => prev.filter(v => v.id !== videoId));
      
      // Remove metadata
      const newMetadata = { ...metadata };
      delete newMetadata[videoId];
      saveMetadata(newMetadata);
      
      if (selectedVideo?.id === videoId) {
        setSelectedVideo(null);
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error.message || 'Failed to delete video');
    }
  };

  const handleShare = async (videoId: string) => {
    const video = libraryVideos.find(v => v.id === videoId);
    if (video) {
      setVideoToShare(video);
      setShareModalOpen(true);
    }
  };

  const handleRetryStorage = async (videoId: string) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/retry-storage`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retry storage');
      }

      // Refresh library to show updated video with storage URLs
      await fetchLibraryVideos();
      
      // If this video is selected, refresh its data by fetching it again
      if (selectedVideo?.id === videoId) {
        try {
          const videoResponse = await fetch(`/api/videos/${videoId}`);
          const videoData = await videoResponse.json();
          if (videoData.success && videoData.video) {
            setSelectedVideo(videoData.video);
          }
        } catch (err) {
          console.error('Failed to refresh selected video:', err);
        }
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error.message || 'Failed to retry storage');
      throw err;
    }
  };

  const handleCancel = async (videoId: string) => {
    if (!confirm('Are you sure you want to cancel this video generation?')) {
      return;
    }

    try {
      const response = await fetch(`/api/videos/${videoId}/cancel`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel video');
      }

      // Refresh library to show updated status
      await fetchLibraryVideos();
      
      // If this video is selected, refresh its data
      if (selectedVideo?.id === videoId) {
        try {
          const videoResponse = await fetch(`/api/videos/${videoId}`);
          const videoData = await videoResponse.json();
          if (videoData.success && videoData.video) {
            setSelectedVideo(videoData.video);
          }
        } catch (err) {
          console.error('Failed to refresh selected video:', err);
        }
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error.message || 'Failed to cancel video');
      throw err;
    }
  };

  const handleResubmit = async (videoId: string) => {
    if (!confirm('Resubmit this video generation with the same parameters?')) {
      return;
    }

    try {
      const response = await fetch(`/api/videos/${videoId}/resubmit`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resubmit video');
      }

      // Refresh library to show updated status
      await fetchLibraryVideos();
      
      // If this video is selected, refresh its data
      if (selectedVideo?.id === videoId) {
        try {
          const videoResponse = await fetch(`/api/videos/${videoId}`);
          const videoData = await videoResponse.json();
          if (videoData.success && videoData.video) {
            setSelectedVideo(videoData.video);
          }
        } catch (err) {
          console.error('Failed to refresh selected video:', err);
        }
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error.message || 'Failed to resubmit video');
      throw err;
    }
  };

  const handleCheckStatus = async (videoId: string) => {
    // Open status modal
    setVideoIdForStatus(videoId);
    setStatusModalOpen(true);
    
    // Also refresh library in background to get latest status
    try {
      await fetchLibraryVideos();
    } catch (err) {
      console.error('Failed to refresh library:', err);
    }
  };
  
  const handleStatusModalClose = () => {
    setStatusModalOpen(false);
    setVideoIdForStatus(null);
    // Refresh library when modal closes to update UI with any changes
    fetchLibraryVideos();
  };

  const handleRegeneratePoster = async (videoId: string, timestampSeconds?: number) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/regenerate-poster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timestampSeconds !== undefined ? { timestampSeconds } : {}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate poster');
      }

      // Refresh library to show updated video with poster URL
      await fetchLibraryVideos();
      
      // If this video is selected, refresh its data
      if (selectedVideo?.id === videoId) {
        try {
          const videoResponse = await fetch(`/api/videos/${videoId}`);
          const videoData = await videoResponse.json();
          if (videoData.success && videoData.video) {
            setSelectedVideo(videoData.video);
          }
        } catch (err) {
          console.error('Failed to refresh selected video:', err);
        }
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error.message || 'Failed to regenerate poster');
      throw err;
    }
  };

  const handleRemix = async (videoId: string, remixPrompt: string) => {
    try {
      const response = await fetch(`/api/videos/${videoId}/remix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remixPrompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create remix');
      }

      // API response wraps data in { success: true, data: {...} }
      const remixVideoData = data.data?.video || data.video;
      if (data.success && remixVideoData) {
        // Generate title and store metadata
        const title = await generateTitle(remixPrompt);
        const newMetadata = {
          ...metadata,
          [remixVideoData.id]: {
            id: remixVideoData.id,
            prompt: remixPrompt,
            title,
            generatedAt: Date.now(),
          },
        };
        saveMetadata(newMetadata);

        // Refresh library to show the new remix video
        await fetchLibraryVideos();
        
        // Select the newly created remix video
        setSelectedVideo(remixVideoData);
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error.message || 'Failed to create remix');
      throw err;
    }
  };

  const handleSharesUpdated = () => {
    // Refresh library to get updated share information
    fetchLibraryVideos();
  };

  const handleDownload = (videoId: string) => {
    // Download via our proxy endpoint which handles authentication
    const link = document.createElement('a');
    link.href = `/api/videos/${videoId}/content`;
    link.download = `${metadata[videoId]?.title || 'video'}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const examplePrompts = [
    'A serene ocean sunset with waves gently crashing on the shore',
    'A futuristic city with flying cars and neon lights at night',
    'A time-lapse of a construction site from foundation to completion',
    'Heavy machinery excavating and moving earth at a construction site',
    'An aerial view of a dredging operation in a busy harbor',
  ];

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('library')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'library'
                  ? 'border-[#1a4d4d] text-[#1a4d4d]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Library ({libraryVideos.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'generate'
                  ? 'border-[#1a4d4d] text-[#1a4d4d]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Generate New</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800 mb-1">Error</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Library Tab */}
        {activeTab === 'library' && (
          <div>
            {/* Filter Tabs */}
            <div className="mb-6 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setLibraryFilter('my-videos')}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    libraryFilter === 'my-videos'
                      ? 'border-[#1a4d4d] text-[#1a4d4d]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  My Videos
                </button>
                <button
                  onClick={() => setLibraryFilter('public')}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    libraryFilter === 'public'
                      ? 'border-[#1a4d4d] text-[#1a4d4d]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Public Videos
                </button>
                <button
                  onClick={() => setLibraryFilter('shared')}
                  className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    libraryFilter === 'shared'
                      ? 'border-[#1a4d4d] text-[#1a4d4d]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Shared with Me
                </button>
              </nav>
            </div>

            {/* Video Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-12 w-12 text-[#1a4d4d]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : libraryVideos.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {libraryFilter === 'my-videos' && 'No videos yet'}
                  {libraryFilter === 'public' && 'No public videos'}
                  {libraryFilter === 'shared' && 'No videos shared with you'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {libraryFilter === 'my-videos' && 'Start by generating your first video'}
                  {libraryFilter === 'public' && 'Be the first to share a public video'}
                  {libraryFilter === 'shared' && 'Videos shared with you will appear here'}
                </p>
                {libraryFilter === 'my-videos' && (
                  <button
                    onClick={() => setActiveTab('generate')}
                    className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg text-white bg-[#1a4d4d] hover:bg-[#2d6666] transition-colors font-medium"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Generate Your First Video
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {libraryVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    isOwner={libraryFilter === 'my-videos'}
                    onDelete={libraryFilter === 'my-videos' ? handleDelete : undefined}
                    onShare={libraryFilter === 'my-videos' ? handleShare : undefined}
                    onRetryStorage={libraryFilter === 'my-videos' ? handleRetryStorage : undefined}
                    onCancel={libraryFilter === 'my-videos' ? handleCancel : undefined}
                    onResubmit={libraryFilter === 'my-videos' ? handleResubmit : undefined}
                    onCheckStatus={libraryFilter === 'my-videos' ? handleCheckStatus : undefined}
                    onRegeneratePoster={libraryFilter === 'my-videos' ? handleRegeneratePoster : undefined}
                    onRemix={libraryFilter === 'my-videos' ? handleRemix : undefined}
                    showOwner={libraryFilter !== 'my-videos'}
                  />
                ))}
              </div>
            )}
          </div>
        )}


        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Generate New Video
              </h2>
              
              <div className="space-y-6">
                {/* Prompt Input */}
                <div>
                  <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                    Video Prompt
                  </label>
                  <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the video you want to generate..."
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4d4d] focus:border-transparent resize-none"
                  />
                </div>

                {/* Reference Media Upload */}
                <VideoUpload
                  onUpload={(data: ReferenceMediaUpload) => setReferenceMedia(data)}
                  onClear={() => setReferenceMedia(null)}
                />

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Duration Selection */}
                  <div>
                    <label htmlFor="seconds" className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (seconds)
                    </label>
                    <select
                      id="seconds"
                      value={seconds}
                      onChange={(e) => setSeconds(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4d4d] focus:border-transparent"
                    >
                      <option value={4}>4 seconds</option>
                      <option value={8}>8 seconds</option>
                      <option value={12}>12 seconds</option>
                    </select>
                  </div>

                  {/* Size/Resolution Selection */}
                  <div>
                    <label htmlFor="size" className="block text-sm font-medium text-gray-700 mb-2">
                      Resolution
                    </label>
                    <select
                      id="size"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4d4d] focus:border-transparent"
                    >
                      <option value="720x1280">720x1280 (Vertical HD)</option>
                      <option value="1280x720">1280x720 (HD)</option>
                      <option value="1920x1080">1920x1080 (Full HD)</option>
                      <option value="1080x1920">1080x1920 (Vertical Full HD)</option>
                      <option value="1080x1080">1080x1080 (Square)</option>
                    </select>
                  </div>
                </div>

                {/* Retention Warning */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="w-full bg-[#1a4d4d] text-white py-4 px-6 rounded-lg font-medium hover:bg-[#2d6666] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-lg"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Generate Video</span>
                    </>
                  )}
                </button>

                {/* Example Prompts */}
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Example Prompts</h3>
                  <div className="space-y-2">
                    {examplePrompts.map((example, index) => (
                      <button
                        key={index}
                        onClick={() => setPrompt(example)}
                        className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-[#1a4d4d] hover:bg-gray-50 transition-colors text-sm text-gray-700"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {videoToShare && (
        <VideoShareModal
          video={videoToShare}
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setVideoToShare(null);
          }}
          onSharesUpdated={handleSharesUpdated}
        />
      )}
      
      {/* Status Modal */}
      {statusModalOpen && videoIdForStatus && (
        <VideoStatusModal
          videoId={videoIdForStatus}
          onClose={handleStatusModalClose}
        />
      )}
    </>
  );
}
