'use client';

import { useState, useEffect } from 'react';

interface ReferenceMedia {
  fileType: 'image' | 'video';
  base64?: string;
  base64Data?: string;
  id?: string;
}

interface VideoRemixModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalPrompt: string;
  referenceMedia?: ReferenceMedia | null;
  onRemix: (remixPrompt: string) => Promise<void>;
}

export function VideoRemixModal({ isOpen, onClose, originalPrompt, referenceMedia, onRemix }: VideoRemixModalProps) {
  const [remixPrompt, setRemixPrompt] = useState('');
  const [isRemixing, setIsRemixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceImageData, setReferenceImageData] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRemixPrompt(originalPrompt);
      setError(null);

      if (referenceMedia?.fileType === 'image' && (referenceMedia.base64 || referenceMedia.base64Data)) {
        setReferenceImageData(referenceMedia.base64 || referenceMedia.base64Data || null);
      } else {
        setReferenceImageData(null);
      }
    }
  }, [isOpen, originalPrompt, referenceMedia]);

  const handleRemix = async () => {
    if (!remixPrompt.trim()) {
      setError('Please enter a remix prompt');
      return;
    }

    setIsRemixing(true);
    setError(null);

    try {
      await onRemix(remixPrompt.trim());
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to create remix');
    } finally {
      setIsRemixing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Remix Video</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" disabled={isRemixing}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-medium text-gray-500 mb-1">Original Prompt:</p>
            <p className="text-sm text-gray-700">{originalPrompt}</p>
          </div>

          {referenceMedia && referenceMedia.fileType === 'image' && referenceImageData && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Reference Image (will be reused):</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <img src={referenceImageData} alt="Reference image" className="w-full h-auto max-h-64 object-contain" />
              </div>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="remix-prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Remix Prompt
            </label>
            <textarea
              id="remix-prompt"
              value={remixPrompt}
              onChange={(e) => setRemixPrompt(e.target.value)}
              placeholder="Modify the prompt to create a remix..."
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4d4d] focus:border-transparent resize-none"
              disabled={isRemixing}
            />
            <p className="mt-2 text-xs text-gray-500">
              Modify the prompt to create a variation of the original video. The remix will use the same duration, resolution, and reference media (if any).
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isRemixing}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleRemix}
              disabled={isRemixing || !remixPrompt.trim()}
              className="px-4 py-2 bg-[#1a4d4d] text-white rounded-lg hover:bg-[#2d6666] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRemixing ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating Remix...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Create Remix
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}










