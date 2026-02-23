'use client';

/**
 * Document Upload Component
 *
 * Handles file upload with progress + optional library selection.
 *
 * Default migration path:
 * - Try data service (if configured) first
 * - Fallback to Next.js route (cookie-auth) for compatibility
 */

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useDropzone } from 'react-dropzone';
import { useBusiboxApi } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';

export type DocumentUploadProps = {
  onUploadComplete?: () => void;
  libraryId?: string; // Pre-selected library (e.g., from current folder)
  /** Render a denser layout for constrained viewports (e.g., mobile full-screen sheet). */
  compact?: boolean;
  /**
   * Optional render hook for a library selector UI.
   * busibox-app does not ship an opinionated LibrarySelector because it is portal-specific.
   */
  renderLibrarySelector?: (args: {
    selectedLibraryId?: string;
    onSelectLibrary: (libraryId?: string) => void;
    disabled: boolean;
  }) => ReactNode;
};

export function DocumentUpload({ onUploadComplete, libraryId, compact = false, renderLibrarySelector }: DocumentUploadProps) {
  const api = useBusiboxApi();

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | undefined>(libraryId);

  // Sync with prop when it changes
  useEffect(() => {
    if (libraryId) setSelectedLibraryId(libraryId);
  }, [libraryId]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setUploading(true);
      setError(null);
      setSuccess(null);
      setProgress(0);

      try {
        const formData = new FormData();
        formData.append('file', file);

        // Add libraryId if selected (Next route understands this; data service may ignore it)
        if (selectedLibraryId) {
          formData.append('libraryId', selectedLibraryId);
        }

        const res = await fetchServiceFirstFallbackNext({
          service: {
            baseUrl: api.services?.dataApiUrl,
            path: '/upload',
            init: {
              method: 'POST',
              body: formData,
            },
          },
          next: {
            nextApiBasePath: api.nextApiBasePath,
            path: '/api/documents/upload',
            init: {
              method: 'POST',
              body: formData,
            },
          },
          // Upload endpoint shapes differ between data and Next; fallback on a wider set of statuses.
          fallback: {
            fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
            fallbackStatuses: [
              ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
              400,
              401,
              403,
              409,
              415,
              422,
            ],
          },
          serviceHeaders: api.serviceRequestHeaders,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as any).error || 'Upload failed');
        }

        setSuccess(`File "${file.name}" uploaded successfully! Processing...`);
        setProgress(100);

        if (onUploadComplete) {
          setTimeout(onUploadComplete, 1500);
        }
      } catch (err: any) {
        console.error('Upload error:', err);
        setError(err?.message || 'Failed to upload file');
      } finally {
        setUploading(false);
      }
    },
    [api.fallback, api.nextApiBasePath, api.serviceRequestHeaders, api.services?.dataApiUrl, onUploadComplete, selectedLibraryId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: uploading,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
  });

  return (
    <div className={`${compact ? 'max-w-none' : 'max-w-3xl'} mx-auto`}>
      <div className={`rounded-lg bg-white ${compact ? 'p-4' : 'p-8'} shadow-md dark:bg-gray-900 dark:shadow-none`}>
        <h2 className={`${compact ? 'mb-4 text-xl' : 'mb-6 text-2xl'} font-bold text-gray-900 dark:text-gray-100`}>
          Upload Document
        </h2>

        {/* Library Selector (injected by consuming app, optional) */}
        {renderLibrarySelector && (
          <div className={compact ? 'mb-4' : 'mb-6'}>
            {renderLibrarySelector({
              selectedLibraryId,
              onSelectLibrary: setSelectedLibraryId,
              disabled: uploading,
            })}
          </div>
        )}

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg ${compact ? 'p-5' : 'p-12'} text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
              : uploading
                ? 'cursor-not-allowed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60'
                : 'border-gray-300 hover:border-blue-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-gray-800/60'
          }`}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center">
            <svg
              className={`mb-4 ${compact ? 'h-12 w-12' : 'h-16 w-16'} ${isDragActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>

            {uploading ? (
              <>
                <p className={`mb-2 ${compact ? 'text-base' : 'text-lg'} font-medium text-gray-900 dark:text-gray-100`}>Uploading...</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Please wait while your file is being uploaded</p>
              </>
            ) : isDragActive ? (
              <p className={`mb-2 ${compact ? 'text-base' : 'text-lg'} font-medium text-blue-600 dark:text-blue-400`}>Drop the file here</p>
            ) : (
              <>
                <p className={`mb-2 ${compact ? 'text-base' : 'text-lg'} font-medium text-gray-900 dark:text-gray-100`}>
                  Drag & drop a file here, or click to select
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Supports PDF, DOCX, DOC, TXT, and MD files</p>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {uploading && (
          <div className={compact ? 'mt-4' : 'mt-6'}>
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className={`${compact ? 'mt-4 p-3' : 'mt-6 p-4'} rounded-lg border border-green-200 bg-green-50 dark:border-green-700/40 dark:bg-green-900/20`}>
            <div className="flex items-start space-x-3">
              <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={`${compact ? 'mt-4 p-3' : 'mt-6 p-4'} rounded-lg border border-red-200 bg-red-50 dark:border-red-700/40 dark:bg-red-900/20`}>
            <div className="flex items-start space-x-3">
              <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h4 className="mb-1 text-sm font-medium text-red-800 dark:text-red-200">Upload Failed</h4>
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className={`${compact ? 'mt-4 p-3' : 'mt-6 p-4'} rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-700/40 dark:bg-blue-900/20`}>
          <div className="flex items-start space-x-3">
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 className="mb-1 text-sm font-semibold text-blue-900 dark:text-blue-200">Processing Pipeline</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                After upload, your document will be automatically processed: parsed, chunked, and embedded for semantic search.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


