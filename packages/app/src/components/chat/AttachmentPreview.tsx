'use client';
/**
 * Attachment Preview Component
 * 
 * Displays attached files with icons, metadata, and remove option
 */


import { AttachmentFile } from './AttachmentUploader';

interface AttachmentPreviewProps {
  attachments: AttachmentFile[];
  onRemove: (id: string) => void;
}

const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('text') || mimeType.includes('markdown')) return '📃';
  if (mimeType.includes('csv') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('json') || mimeType.includes('xml')) return '📋';
  return '📎';
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function AttachmentPreview({
  attachments,
  onRemove,
}: AttachmentPreviewProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-xs font-medium text-gray-700 mb-2">
        Attachments ({attachments.length})
      </div>

      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* File icon */}
              <div className="text-2xl flex-shrink-0">
                {getFileIcon(attachment.file.type)}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.file.name}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <span>{formatFileSize(attachment.file.size)}</span>
                  {attachment.status === 'uploading' && (
                    <span className="text-blue-600">Uploading...</span>
                  )}
                  {attachment.status === 'processing' && (
                    <span className="text-yellow-600">Processing...</span>
                  )}
                  {attachment.status === 'ready' && (
                    <span className="text-green-600">Ready</span>
                  )}
                  {attachment.status === 'error' && (
                    <span className="text-red-600">Error</span>
                  )}
                </div>
                {attachment.progress !== undefined && attachment.progress < 100 && (
                  <div className="mt-1">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${attachment.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Remove button */}
            <button
              onClick={() => onRemove(attachment.id)}
              className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
              title="Remove attachment"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

