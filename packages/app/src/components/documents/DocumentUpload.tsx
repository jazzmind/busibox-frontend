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
import { useBusiboxApi, useCrossAppApiPath, useCrossAppBasePath } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';

type FileUploadStatus = {
  name: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
};

export type DocumentUploadProps = {
  onUploadComplete?: () => void;
  libraryId?: string; // Pre-selected library (e.g., from current folder)
  /** Allow selecting multiple files at once. Default false. */
  multiple?: boolean;
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

export function DocumentUpload({ onUploadComplete, libraryId, multiple = false, compact = false, renderLibrarySelector }: DocumentUploadProps) {
  const api = useBusiboxApi();
  const resolve = useCrossAppApiPath();
  const documentsBase = useCrossAppBasePath('documents');

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | undefined>(libraryId);
  const [fileStatuses, setFileStatuses] = useState<FileUploadStatus[]>([]);

  // Sync with prop when it changes
  useEffect(() => {
    if (libraryId) setSelectedLibraryId(libraryId);
  }, [libraryId]);

  const uploadSingleFile = useCallback(
    async (file: File): Promise<boolean> => {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedLibraryId) {
        formData.append('libraryId', selectedLibraryId);
      }

      const res = await fetchServiceFirstFallbackNext({
        service: {
          baseUrl: api.services?.dataApiUrl,
          path: '/upload',
          init: { method: 'POST', body: formData },
        },
        next: {
          nextApiBasePath: documentsBase,
          path: '/api/documents/upload',
          init: { method: 'POST', body: formData },
        },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: [
            ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
            400, 401, 403, 409, 415, 422,
          ],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any).error || 'Upload failed');
      }
      return true;
    },
    [api.fallback, api.serviceRequestHeaders, api.services?.dataApiUrl, documentsBase, selectedLibraryId]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setUploading(true);
      setError(null);
      setSuccess(null);
      setProgress(0);

      if (!multiple) {
        // Single-file upload (original behaviour)
        const file = acceptedFiles[0];
        try {
          await uploadSingleFile(file);
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
        return;
      }

      // Multi-file: upload sequentially with per-file status tracking
      const statuses: FileUploadStatus[] = acceptedFiles.map((f) => ({
        name: f.name,
        status: 'pending' as const,
      }));
      setFileStatuses(statuses);

      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < acceptedFiles.length; i++) {
        setFileStatuses((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: 'uploading' } : s))
        );
        setProgress(Math.round((i / acceptedFiles.length) * 100));

        try {
          await uploadSingleFile(acceptedFiles[i]);
          successCount++;
          setFileStatuses((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, status: 'success' } : s))
          );
        } catch (err: any) {
          errorCount++;
          setFileStatuses((prev) =>
            prev.map((s, idx) =>
              idx === i ? { ...s, status: 'error', error: err?.message || 'Failed' } : s
            )
          );
        }
      }

      setProgress(100);
      if (errorCount === 0) {
        setSuccess(`All ${successCount} file${successCount !== 1 ? 's' : ''} uploaded successfully! Processing...`);
      } else if (successCount > 0) {
        setSuccess(`${successCount} uploaded, ${errorCount} failed.`);
      } else {
        setError(`All ${errorCount} uploads failed.`);
      }

      setUploading(false);
      if (successCount > 0 && onUploadComplete) {
        setTimeout(onUploadComplete, 1500);
      }
    },
    [multiple, uploadSingleFile, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
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
                <p className="text-sm text-gray-600 dark:text-gray-300">Please wait while your {multiple ? 'files are' : 'file is'} being uploaded</p>
              </>
            ) : isDragActive ? (
              <p className={`mb-2 ${compact ? 'text-base' : 'text-lg'} font-medium text-blue-600 dark:text-blue-400`}>Drop {multiple ? 'files' : 'the file'} here</p>
            ) : (
              <>
                <p className={`mb-2 ${compact ? 'text-base' : 'text-lg'} font-medium text-gray-900 dark:text-gray-100`}>
                  Drag & drop {multiple ? 'files' : 'a file'} here, or click to select
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

        {/* Per-file status list (multi-file mode) */}
        {multiple && fileStatuses.length > 0 && (
          <div className={`${compact ? 'mt-3' : 'mt-4'} max-h-40 overflow-y-auto space-y-1`}>
            {fileStatuses.map((fs, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                {fs.status === 'pending' && <span className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600 inline-block flex-shrink-0" />}
                {fs.status === 'uploading' && <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin inline-block flex-shrink-0" />}
                {fs.status === 'success' && (
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                )}
                {fs.status === 'error' && (
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                )}
                <span className={`truncate ${fs.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {fs.name}{fs.error ? ` — ${fs.error}` : ''}
                </span>
              </div>
            ))}
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


