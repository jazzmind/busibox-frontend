'use client';

/**
 * VideoUpload Component
 *
 * Drag-and-drop file upload area for reference images and videos.
 * Validates file type and size, shows preview, and converts to base64.
 */

import { useState, useRef } from 'react';
import { validateReferenceFile, fileToBase64, getFormatFromMimeType, getFileTypeFromMimeType, formatFileSize } from '../../lib/media/upload';
import { ReferenceMediaType, type ReferenceMediaUpload } from '../../types/video';

interface VideoUploadProps {
  onUpload: (data: ReferenceMediaUpload) => void;
  onClear: () => void;
}

export function VideoUpload({ onUpload, onClear }: VideoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);

    const validation = validateReferenceFile(file);
    if (!validation.valid) {
      setError(validation.error!);
      return;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const type = getFileTypeFromMimeType(file.type);
      const format = getFormatFromMimeType(file.type);

      setPreview(base64);
      setFileType(type);
      setFileName(file.name);
      setFileSize(file.size);

      onUpload({
        base64,
        fileType: type === 'image' ? ReferenceMediaType.IMAGE : ReferenceMediaType.VIDEO,
        format: format as any,
        fileSizeBytes: file.size,
      });
    } catch (err) {
      setError('Failed to process file. Please try again.');
      console.error('File upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setFileType(null);
    setFileName(null);
    setFileSize(null);
    setError(null);
    onClear();
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFile(files[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFile(files[0]);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Reference Media (Optional)</label>
      <p className="text-xs text-gray-500 mb-2">Upload an image or video to guide the generation style</p>

      {preview ? (
        <div className="border border-gray-300 rounded-lg p-4 bg-white">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {fileType === 'image' ? (
                <img src={preview} alt="Preview" className="max-h-32 max-w-32 rounded object-cover" />
              ) : (
                <video src={preview} className="max-h-32 max-w-32 rounded" controls />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
              <p className="text-xs text-gray-500 mt-1">
                {fileType?.toUpperCase()} • {fileSize && formatFileSize(fileSize)}
              </p>
              <button
                onClick={handleClear}
                className="mt-3 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                type="button"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'}
            ${uploading ? 'opacity-50 cursor-wait' : ''}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
            onChange={handleInputChange}
            className="hidden"
            disabled={uploading}
          />

          {uploading ? (
            <div className="text-gray-600">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
              <p className="text-sm">Processing file...</p>
            </div>
          ) : (
            <>
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="mt-1 text-xs text-gray-500">JPG, PNG, WebP (10MB max) • MP4, MOV (25MB max)</p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}










