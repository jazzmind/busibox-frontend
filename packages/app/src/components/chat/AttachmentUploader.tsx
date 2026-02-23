/**
 * Attachment Uploader Component
 * 
 * File input with drag-and-drop and validation.
 */

'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import toast from 'react-hot-toast';

export interface AttachmentFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'ready' | 'error';
  progress?: number;
  attachmentId?: string;
  filename?: string;
  fileUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  addedToLibrary?: boolean;
}

interface AttachmentUploaderProps {
  onFilesSelected: (files: AttachmentFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

const SUPPORTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/xml',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

export function AttachmentUploader({
  onFilesSelected,
  maxFiles = 5,
  maxSizeMB = 25,
}: AttachmentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!SUPPORTED_TYPES.includes(file.type)) {
      return `File type "${file.type}" is not supported`;
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }

    return null;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles: AttachmentFile[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file, index) => {
      if (validFiles.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return;
      }

      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return;
      }

      validFiles.push({
        id: `temp-${Date.now()}-${index}`,
        file,
        status: 'pending',
      });
    });

    if (errors.length > 0) {
      errors.forEach((error) => toast.error(error));
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SUPPORTED_TYPES.join(',')}
          onChange={handleFileInput}
          className="hidden"
        />

        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <p className="text-sm text-gray-600 mb-1">
          <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">
          PDF, DOCX, TXT, MD, Images, CSV, JSON, XML (max {maxSizeMB}MB)
        </p>
      </div>
    </div>
  );
}

