'use client';
/**
 * Message Input Component
 * 
 * Text input with send button, character counter, and Enter key handling
 */


import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import toast from 'react-hot-toast';
import { AttachmentUploader, AttachmentFile } from './AttachmentUploader';
import { AttachmentPreview } from './AttachmentPreview';
import type { MessageAttachment } from '../../types/chat';
import { useCrossAppApiPath } from '../../contexts/ApiContext';

interface MessageInputProps {
  onSend: (
    content: string,
    attachmentIds?: string[],
    attachmentMeta?: MessageAttachment[]
  ) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  maxLength?: number;
  conversationId?: string;
  /** Called when a conversation is needed but none exists (e.g. user attaches a file).
   *  Should create a conversation and return its ID, or null on failure. */
  onEnsureConversation?: () => Promise<string | null>;
}

export function MessageInput({
  onSend,
  onStop,
  disabled = false,
  isStreaming = false,
  placeholder = 'Type your message...',
  maxLength = 10000,
  conversationId,
  onEnsureConversation,
}: MessageInputProps) {
  const resolve = useCrossAppApiPath();
  const [content, setContent] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [showUploader, setShowUploader] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showStopButton, setShowStopButton] = useState(false);

  // Show stop button after a short delay to prevent accidental double-clicks
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isStreaming) {
      timer = setTimeout(() => {
        setShowStopButton(true);
      }, 300); // 300ms delay
    } else {
      setShowStopButton(false);
    }
    return () => clearTimeout(timer);
  }, [isStreaming]);

  const handleSend = async () => {
    const trimmed = content.trim();
    const hasAttachments = attachments.length > 0 && attachments.every((a) => a.status === 'ready');

    if ((!trimmed && !hasAttachments) || disabled) {
      return;
    }

    if (trimmed.length > maxLength) {
      return;
    }

    // Get attachment IDs
    const attachmentIds = attachments
      .filter((a) => a.status === 'ready' && a.attachmentId)
      .map((a) => a.attachmentId!);

    const attachmentMeta = attachments
      .filter((a) => a.status === 'ready' && a.attachmentId)
      .map((a) => ({
        id: a.attachmentId!,
        filename: a.filename || a.file.name,
        fileUrl: a.fileUrl || '',
        mimeType: a.mimeType || a.file.type || 'application/octet-stream',
        sizeBytes: a.sizeBytes ?? a.file.size,
        addedToLibrary: a.addedToLibrary ?? true,
      }));

    onSend(
      trimmed || ' ',
      attachmentIds.length > 0 ? attachmentIds : undefined,
      attachmentMeta.length > 0 ? attachmentMeta : undefined
    );
    setContent('');
    setAttachments([]);
    setShowUploader(false);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFilesSelected = async (files: AttachmentFile[]) => {
    // If no conversation exists, try to create one automatically
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      if (onEnsureConversation) {
        const newId = await onEnsureConversation();
        if (!newId) {
          toast.error('Failed to start conversation for attachment');
          return;
        }
        activeConversationId = newId;
      } else {
        toast.error('Please send a message first to start a conversation');
        return;
      }
    }

    // Update attachments with pending status
    setAttachments((prev) => [...prev, ...files]);

    // Upload each file
    for (const file of files) {
      try {
        // Update status to uploading
        setAttachments((prev) =>
          prev.map((a) => (a.id === file.id ? { ...a, status: 'uploading' as const, progress: 0 } : a))
        );

        const formData = new FormData();
        formData.append('file', file.file);

        const response = await fetch(resolve('chat', `/api/chat/conversations/${activeConversationId}/attachments`), {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const result = await response.json();

        // Update status to ready
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === file.id
              ? {
                  ...a,
                  status: 'ready' as const,
                  attachmentId: result.id,
                  filename: result.filename || file.file.name,
                  fileUrl: result.fileUrl || '',
                  mimeType: result.mimeType || file.file.type || 'application/octet-stream',
                  sizeBytes: result.sizeBytes ?? file.file.size,
                  addedToLibrary: result.addedToLibrary ?? true,
                  progress: 100,
                }
              : a
          )
        );

        toast.success(`${file.file.name} uploaded`);
      } catch (error) {
        console.error('Failed to upload attachment:', error);
        setAttachments((prev) =>
          prev.map((a) => (a.id === file.id ? { ...a, status: 'error' as const } : a))
        );
        toast.error(`Failed to upload ${file.file.name}`);
      }
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (but not Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    if (value.length <= maxLength) {
      setContent(value);
      
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }
  };

  const remainingChars = maxLength - content.length;
  const hasContent = content.trim().length > 0;
  const hasReadyAttachments = attachments.some((a) => a.status === 'ready');
  const canSend = (hasContent || hasReadyAttachments) && !disabled && remainingChars >= 0;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Attachment preview */}
        {attachments.length > 0 && (
          <div className="mb-3">
            <AttachmentPreview
              attachments={attachments}
              onRemove={handleRemoveAttachment}
            />
          </div>
        )}

        {/* Attachment uploader (collapsible) */}
        {showUploader && (
          <div className="mb-3">
            <AttachmentUploader
              onFilesSelected={handleFilesSelected}
              maxFiles={5}
              maxSizeMB={25}
            />
          </div>
        )}

        {/* Character counter */}
        {content.length > maxLength * 0.8 && (
          <div className="mb-2 text-xs text-gray-500 text-right">
            {remainingChars} characters remaining
          </div>
        )}

        {/* Input area */}
        <div className="flex gap-3 items-end">
          {/* Attachment button - always visible */}
          <button
            onClick={() => setShowUploader(!showUploader)}
            className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex-shrink-0"
            title="Attach file"
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
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{ minHeight: '52px', maxHeight: '200px' }}
            />
          </div>

          {/* Send/Stop button */}
          {showStopButton && onStop ? (
            <button
              onClick={onStop}
              className="px-6 py-3 rounded-lg font-medium transition-colors flex-shrink-0 bg-red-600 text-white hover:bg-red-700"
              title="Stop generating"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
          ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`px-6 py-3 rounded-lg font-medium transition-colors flex-shrink-0 ${
              canSend
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
              title={canSend ? 'Send message' : 'Type a message to send'}
          >
              {disabled && !showStopButton ? (
                // Thinking indicator (3 dots)
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            ) : (
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
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
          )}
        </div>

        {/* Helper text */}
        <div className="mt-2 text-xs text-gray-500 text-center">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

