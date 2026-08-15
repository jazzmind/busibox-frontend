'use client';

import { useRef, useState, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { Mic, Paperclip, Send, Square } from 'lucide-react';
import { useCrossAppApiPath } from '@jazzmind/busibox-app/contexts';
import type { MessageAttachment } from '@jazzmind/busibox-app/types/chat';
import { Tooltip } from './primitives/Tooltip';
import { MarineAttachmentStatus } from './AttachmentStatus';
import { marineBrand } from './config';

interface MarineComposerProps {
  onSend: (
    content: string,
    attachmentIds?: string[],
    attachmentMeta?: MessageAttachment[],
  ) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  conversationId?: string;
  onEnsureConversation?: () => Promise<string | null>;
}

interface AttachmentDraft {
  id: string;
  file: File;
  status: 'uploading' | 'ready' | 'error';
  attachmentId?: string;
  filename?: string;
  fileUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  addedToLibrary?: boolean;
}

const SUPPORTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export function MarineComposer({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = marineBrand.composerPlaceholder,
  conversationId,
  onEnsureConversation,
}: MarineComposerProps) {
  const resolve = useCrossAppApiPath();
  const [content, setContent] = useState('');
  const [focused, setFocused] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [content]);

  const uploadFile = async (file: File, activeConversationId: string) => {
    const draftId = `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setAttachments((prev) => [...prev, { id: draftId, file, status: 'uploading' }]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        resolve('chat', `/api/chat/conversations/${activeConversationId}/attachments`),
        { method: 'POST', body: formData },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Upload failed');
      }

      const result = await response.json();
      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.id === draftId
            ? {
                ...attachment,
                status: 'ready',
                attachmentId: result.id,
                filename: result.filename || file.name,
                fileUrl: result.fileUrl || '',
                mimeType: result.mimeType || file.type || 'application/octet-stream',
                sizeBytes: result.sizeBytes ?? file.size,
                addedToLibrary: result.addedToLibrary ?? true,
              }
            : attachment,
        ),
      );
      toast.success(`${file.name} attached`);
    } catch (error: any) {
      console.error('Failed to upload attachment:', error);
      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.id === draftId ? { ...attachment, status: 'error' } : attachment,
        ),
      );
      toast.error(error?.message || `Failed to upload ${file.name}`);
    }
  };

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (selectedFiles.length === 0) return;

    const validFiles = selectedFiles.filter((file) => {
      if (!SUPPORTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`${file.name}: file exceeds 25MB`);
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) return;

    let activeConversationId: string | null = conversationId ?? null;
    if (!activeConversationId) {
      activeConversationId = await onEnsureConversation?.() || null;
    }
    if (!activeConversationId) {
      toast.error('Failed to start conversation for attachment');
      return;
    }

    await Promise.all(validFiles.map((file) => uploadFile(file, activeConversationId)));
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  };

  const handleSend = () => {
    const trimmed = content.trim();
    const readyAttachments = attachments.filter(
      (attachment) => attachment.status === 'ready' && attachment.attachmentId,
    );
    const hasUploadingAttachments = attachments.some(
      (attachment) => attachment.status === 'uploading',
    );
    if ((!trimmed && readyAttachments.length === 0) || disabled || hasUploadingAttachments) {
      return;
    }

    const attachmentIds = readyAttachments.map((attachment) => attachment.attachmentId!);
    const attachmentMeta = readyAttachments.map((attachment) => ({
      id: attachment.attachmentId!,
      filename: attachment.filename || attachment.file.name,
      fileUrl: attachment.fileUrl || '',
      mimeType: attachment.mimeType || attachment.file.type || 'application/octet-stream',
      sizeBytes: attachment.sizeBytes ?? attachment.file.size,
      addedToLibrary: attachment.addedToLibrary ?? true,
    }));

    onSend(
      trimmed || ' ',
      attachmentIds.length > 0 ? attachmentIds : undefined,
      attachmentMeta.length > 0 ? attachmentMeta : undefined,
    );
    setContent('');
    setAttachments([]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasContent = content.trim().length > 0;
  const hasReadyAttachments = attachments.some((attachment) => attachment.status === 'ready');
  const hasUploadingAttachments = attachments.some((attachment) => attachment.status === 'uploading');
  const canSend = (hasContent || hasReadyAttachments) && !disabled && !hasUploadingAttachments;

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col items-center px-5 pb-4 pt-3">
      <div
        className="w-full rounded-[14px] p-px"
        style={{
          backgroundColor: 'var(--marine-teal)',
          boxShadow: focused
            ? '0 12px 24px rgba(6,130,132,0.22)'
            : '0 10px 16px rgba(6,130,132,0.12)',
          transition: 'box-shadow 200ms ease-out',
        }}
      >
        <div
          className="rounded-[13px] px-4 py-2"
          style={{ backgroundColor: 'var(--marine-teal-tint)' }}
        >
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <MarineAttachmentStatus
                  key={attachment.id}
                  attachment={{
                    id: attachment.attachmentId || attachment.id,
                    filename: attachment.filename || attachment.file.name,
                    fileUrl: attachment.fileUrl || '',
                    mimeType: attachment.mimeType || attachment.file.type,
                    sizeBytes: attachment.sizeBytes ?? attachment.file.size,
                    addedToLibrary: attachment.addedToLibrary,
                  }}
                  localStatus={attachment.status}
                  onRemove={() => removeAttachment(attachment.id)}
                  align="left"
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={SUPPORTED_TYPES.join(',')}
              onChange={handleFilesSelected}
              className="hidden"
            />

            <Tooltip label="Attach a file">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--marine-teal-light)]"
                style={{ color: 'var(--marine-text-muted)' }}
              >
                <Paperclip className="h-5 w-5" />
              </button>
            </Tooltip>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={placeholder}
              rows={1}
              disabled={disabled}
              className="min-h-[24px] max-h-[200px] flex-1 resize-none border-0 py-2 text-base outline-none placeholder:text-[var(--marine-text-muted)]"
              style={{
                color: 'var(--marine-text)',
                // Inline background wins over the `.dark textarea` rule in
                // globals.css that would otherwise force gray-900 here.
                backgroundColor: 'transparent',
                border: 'none',
                boxShadow: 'none',
              }}
            />

            <div className="flex flex-shrink-0 items-center gap-2">
              <Tooltip label="Voice input">
                <button
                  type="button"
                  aria-label="Voice"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--marine-teal-light)]"
                  style={{ color: 'var(--marine-text-muted)' }}
                >
                  <Mic className="h-5 w-5" />
                </button>
              </Tooltip>

              {isStreaming && onStop ? (
                <Tooltip label="Stop generating">
                  <button
                    type="button"
                    onClick={onStop}
                    aria-label="Stop"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95"
                    style={{
                      backgroundColor: 'var(--marine-teal)',
                      boxShadow: '0 5px 7px rgba(6,130,132,0.25)',
                    }}
                  >
                    <Square className="h-4 w-4" />
                  </button>
                </Tooltip>
              ) : (
                <Tooltip label={canSend ? 'Send message' : hasUploadingAttachments ? 'Uploading attachment' : 'Type a message'}>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!canSend}
                    aria-label="Send"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-all disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100 active:scale-95"
                    style={{
                      backgroundColor: canSend ? 'var(--marine-teal)' : 'var(--marine-teal-muted)',
                      boxShadow: canSend
                        ? '0 5px 7px rgba(6,130,132,0.25)'
                        : 'none',
                    }}
                  >
                    <Send className="h-[18px] w-[18px]" />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>

      <p
        className="pt-3 text-center text-[11px] leading-4"
        style={{ color: 'var(--marine-text-muted)' }}
      >
        {marineBrand.disclaimer}
      </p>
    </div>
  );
}
