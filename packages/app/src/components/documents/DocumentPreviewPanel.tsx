'use client';

import { X, FileText } from 'lucide-react';
import { HtmlViewer } from './HtmlViewer';

interface DocumentPreviewPanelProps {
  fileId: string;
  page?: number;
  onClose: () => void;
}

/**
 * Slide-in side panel that renders a document's HTML content and scrolls to
 * the specified page. Intended to be rendered as a sibling of the chat message
 * area (e.g., inside ChatContainer alongside the Insights panel).
 */
export function DocumentPreviewPanel({ fileId, page, onClose }: DocumentPreviewPanelProps) {
  return (
    <div className="w-[45%] max-w-2xl min-w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            Source Document
            {page ? ` — Page ${page}` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded transition-colors flex-shrink-0 ml-2"
          title="Close document preview"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-y-auto">
        <HtmlViewer fileId={fileId} initialPage={page} />
      </div>
    </div>
  );
}
