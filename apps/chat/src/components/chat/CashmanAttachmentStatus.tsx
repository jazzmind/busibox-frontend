'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, X } from 'lucide-react';
import { useCrossAppApiPath, useCrossAppBasePath } from '@jazzmind/busibox-app/contexts';

export interface CashmanAttachmentDisplay {
  id: string;
  filename: string;
  fileUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  addedToLibrary?: boolean;
}

export type LocalAttachmentStatus = 'uploading' | 'ready' | 'error';

interface DocumentStatusResponse {
  fileId?: string;
  status?: {
    stage?: string | null;
    progress?: number | null;
    chunksProcessed?: number | null;
    totalChunks?: number | null;
    pagesProcessed?: number | null;
    totalPages?: number | null;
    errorMessage?: string | null;
    statusMessage?: string | null;
    passDetails?: {
      currentPass?: number;
      totalPasses?: number;
      passName?: string;
    } | null;
  };
}

interface CashmanAttachmentStatusProps {
  attachment: CashmanAttachmentDisplay;
  localStatus?: LocalAttachmentStatus;
  onRemove?: () => void;
  align?: 'left' | 'right';
}

const ACTIVE_STAGES = new Set([
  'queued',
  'uploading',
  'processing',
  'parsing',
  'chunking',
  'embedding',
  'indexing',
  'available',
]);

const COMPLETE_STAGES = new Set(['completed', 'complete']);
const FAILED_STAGES = new Set(['failed', 'cancelled', 'error']);

export function extractAttachmentFileId(fileUrl?: string): string | null {
  if (!fileUrl) return null;
  return fileUrl.match(/\/files\/([^/]+)\/download/)?.[1] || null;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeStage(stage?: string | null): string {
  return String(stage || '').toLowerCase();
}

function stageLabel(stage: string, localStatus: LocalAttachmentStatus | undefined, awaitingStatus: boolean): string {
  if (localStatus === 'uploading') return 'Uploading';
  if (localStatus === 'error') return 'Upload failed';
  if (stage === 'available') return 'Enhancing';
  if (stage === 'completed' || stage === 'complete') return 'Ready';
  if (stage === 'failed') return 'Failed';
  if (stage === 'cancelled') return 'Cancelled';
  if (!stage) return awaitingStatus ? 'Processing' : 'Ready';
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

function statusTone(stage: string, localStatus?: LocalAttachmentStatus): 'active' | 'complete' | 'failed' | 'idle' {
  if (localStatus === 'uploading') return 'active';
  if (localStatus === 'error') return 'failed';
  if (FAILED_STAGES.has(stage)) return 'failed';
  if (ACTIVE_STAGES.has(stage)) return 'active';
  if (COMPLETE_STAGES.has(stage)) return 'complete';
  return 'idle';
}

function progressFromStatus(status?: DocumentStatusResponse['status']): number | null {
  if (!status) return null;
  if (typeof status.progress === 'number') {
    return Math.max(0, Math.min(100, status.progress));
  }
  if (
    typeof status.pagesProcessed === 'number' &&
    typeof status.totalPages === 'number' &&
    status.totalPages > 0
  ) {
    return Math.max(0, Math.min(100, (status.pagesProcessed / status.totalPages) * 100));
  }
  if (
    typeof status.chunksProcessed === 'number' &&
    typeof status.totalChunks === 'number' &&
    status.totalChunks > 0
  ) {
    return Math.max(0, Math.min(100, (status.chunksProcessed / status.totalChunks) * 100));
  }
  return null;
}

function detailText(
  attachment: CashmanAttachmentDisplay,
  status?: DocumentStatusResponse['status'],
  localStatus?: LocalAttachmentStatus,
): string {
  if (localStatus === 'uploading') return 'Uploading';
  if (localStatus === 'error') return 'Upload failed';
  if (status?.errorMessage) return status.errorMessage;
  if (status?.passDetails?.passName) {
    return `Pass ${status.passDetails.currentPass || 1}/${status.passDetails.totalPasses || 1}: ${status.passDetails.passName}`;
  }
  if (status?.statusMessage) return status.statusMessage;
  if (
    typeof status?.pagesProcessed === 'number' &&
    typeof status?.totalPages === 'number' &&
    status.totalPages > 0
  ) {
    return `Pages ${status.pagesProcessed} / ${status.totalPages}`;
  }
  return formatFileSize(attachment.sizeBytes);
}

export function CashmanAttachmentStatus({
  attachment,
  localStatus = 'ready',
  onRemove,
  align = 'right',
}: CashmanAttachmentStatusProps) {
  const resolve = useCrossAppApiPath();
  const documentsBase = useCrossAppBasePath('documents');
  const [documentStatus, setDocumentStatus] = useState<DocumentStatusResponse | null>(null);
  const [statusUnavailable, setStatusUnavailable] = useState(false);

  const fileId = useMemo(() => extractAttachmentFileId(attachment.fileUrl), [attachment.fileUrl]);
  const stage = normalizeStage(documentStatus?.status?.stage);
  const tone = statusTone(stage, localStatus);
  const progress = progressFromStatus(documentStatus?.status);
  const awaitingStatus = !stage && localStatus === 'ready' && !!fileId && !statusUnavailable;
  const isActive = localStatus === 'uploading' || ACTIVE_STAGES.has(stage) || awaitingStatus;
  const href = fileId ? `${documentsBase}/${fileId}` : attachment.fileUrl;

  useEffect(() => {
    if (!fileId || localStatus !== 'ready') return;
    let cancelled = false;
    let interval: NodeJS.Timeout | null = null;

    const fetchStatus = async () => {
      try {
        const response = await fetch(resolve('documents', `/api/documents/${fileId}/status`), {
          headers: { 'X-Quiet-Logs': '1' },
        });
        if (!response.ok) {
          if (!cancelled) setStatusUnavailable(true);
          return;
        }
        const result = await response.json();
        if (cancelled) return;
        const data = result.data || result;
        setDocumentStatus(data);
        setStatusUnavailable(false);

        const nextStage = normalizeStage(data?.status?.stage);
        if (!ACTIVE_STAGES.has(nextStage) && interval) {
          clearInterval(interval);
          interval = null;
        }
      } catch {
        if (!cancelled) setStatusUnavailable(true);
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, 5000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [fileId, localStatus, resolve]);

  const icon =
    tone === 'active' ? (
      <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" style={{ color: 'var(--cashman-teal)' }} />
    ) : tone === 'failed' ? (
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--cashman-error)' }} />
    ) : tone === 'complete' ? (
      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--cashman-teal)' }} />
    ) : (
      <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--cashman-teal)' }} />
    );

  const chip = (
    <div
      className="relative inline-flex max-w-full items-center gap-2 overflow-hidden rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:brightness-95"
      style={{
        borderColor: tone === 'failed' ? 'var(--cashman-error)' : 'var(--cashman-teal-border)',
        backgroundColor: 'var(--cashman-surface)',
        color: 'var(--cashman-text-body)',
      }}
    >
      {icon}
      <span className="max-w-[260px] truncate font-medium">{attachment.filename}</span>
      <span className="flex-shrink-0" style={{ color: 'var(--cashman-text-muted)' }}>
        {stageLabel(stage, localStatus, awaitingStatus)}
      </span>
      {detailText(attachment, documentStatus?.status, localStatus) && (
        <span className="hidden max-w-[220px] truncate sm:inline" style={{ color: 'var(--cashman-text-muted)' }}>
          {detailText(attachment, documentStatus?.status, localStatus)}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onRemove();
          }}
          className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-[var(--cashman-teal-light)]"
          style={{ color: 'var(--cashman-text-muted)' }}
          aria-label={`Remove ${attachment.filename}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {progress !== null && isActive && (
        <span
          className="absolute bottom-0 left-0 h-0.5 rounded-full"
          style={{
            width: `${progress}%`,
            backgroundColor: 'var(--cashman-teal)',
          }}
        />
      )}
    </div>
  );

  return (
    <span className={`relative inline-flex max-w-full ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      {href && !onRemove ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="max-w-full">
          {chip}
        </a>
      ) : (
        chip
      )}
    </span>
  );
}
