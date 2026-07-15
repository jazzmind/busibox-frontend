'use client';

/**
 * Source Document Panel — right-side panel that opens when a citation is clicked.
 *
 * States:
 *   - normal: user-resizable width (drag the left edge splitter). Width persists
 *     in localStorage. On narrow viewports the panel becomes a full-width overlay.
 *   - maximized: temporarily fills the parent flex row (chat pane hidden by the
 *     parent when it wants to react to onMaximizedChange).
 *
 * Adaptive rules:
 *   - Min width: 380px
 *   - Max width: min(viewport - 420, 900)  (keep 420px reserved for chat)
 *   - Viewport <= 900px: overlay, full-width, no splitter
 *
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FileText,
  Download,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { HtmlViewer } from '@jazzmind/busibox-app/components/documents/HtmlViewer';
import { useCrossAppApiPath } from '@jazzmind/busibox-app/contexts';
import { Tooltip } from './primitives/Tooltip';

interface SourcePanelProps {
  fileId: string;
  page?: number;
  filename?: string;
  onClose: () => void;
  onMaximizedChange?: (maximized: boolean) => void;
}

interface DocumentStatusResponse {
  fileId?: string;
  filename?: string;
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

const ACTIVE_STAGES = new Set([
  'queued',
  'uploading',
  'processing',
  'parsing',
  'chunking',
  'embedding',
  'indexing',
]);

const WIDTH_STORAGE_KEY = 'marine-source-width';
const MIN_WIDTH = 380;
const CHAT_RESERVED = 420;
const OVERLAY_BREAKPOINT = 900;
const DEFAULT_WIDTH = 560;

/** Compute the max allowed width given the current viewport. */
function computeMaxWidth(vw: number): number {
  return Math.max(MIN_WIDTH, Math.min(vw - CHAT_RESERVED, 900));
}

/** Clamp a candidate width into the valid range. */
function clampWidth(candidate: number, vw: number): number {
  const max = computeMaxWidth(vw);
  return Math.min(Math.max(candidate, MIN_WIDTH), max);
}

/** Read persisted preferred width, falling back to default. */
function readPersisted(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_WIDTH;
}

export function MarineSourcePanel({
  fileId,
  page,
  filename = 'Source Document',
  onClose,
  onMaximizedChange,
}: SourcePanelProps) {
  const resolve = useCrossAppApiPath();
  const [maximized, setMaximized] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  );
  const [preferredWidth, setPreferredWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const [documentStatus, setDocumentStatus] = useState<DocumentStatusResponse | null>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Load persisted width on mount + subscribe to viewport resize
  useEffect(() => {
    setPreferredWidth((prev) => clampWidth(readPersisted(), window.innerWidth) || prev);
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Clamp preferred width when viewport shrinks/expands
  useEffect(() => {
    setPreferredWidth((prev) => clampWidth(prev, viewportWidth));
  }, [viewportWidth]);

  // Persist width whenever it settles
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (dragging) return;
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(preferredWidth));
  }, [preferredWidth, dragging]);

  const isOverlay = viewportWidth <= OVERLAY_BREAKPOINT;

  const toggleMax = useCallback(() => {
    setMaximized((v) => {
      const next = !v;
      onMaximizedChange?.(next);
      return next;
    });
  }, [onMaximizedChange]);

  // Splitter drag handlers
  const onSplitterPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isOverlay || maximized) return;
      e.preventDefault();
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
      dragStartX.current = e.clientX;
      dragStartWidth.current = preferredWidth;
      setDragging(true);
    },
    [isOverlay, maximized, preferredWidth],
  );

  const onSplitterPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      // Splitter is on the left edge; dragging LEFT increases width
      const delta = dragStartX.current - e.clientX;
      const next = clampWidth(dragStartWidth.current + delta, viewportWidth);
      setPreferredWidth(next);
    },
    [dragging, viewportWidth],
  );

  const onSplitterPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
      setDragging(false);
    },
    [dragging],
  );

  // Body cursor override while dragging
  useEffect(() => {
    if (!dragging) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = prev;
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  const documentsBase = process.env.NEXT_PUBLIC_DOCUMENTS_BASE_PATH || '/documents';
  const downloadHref = `${documentsBase}/${fileId}${page ? `?page=${page}` : ''}`;
  const status = documentStatus?.status;
  const stage = String(status?.stage || '').toLowerCase();
  const isProcessing = ACTIVE_STAGES.has(stage);
  const isEnhancing = stage === 'available';
  const displayFilename = filename === 'Source Document'
    ? documentStatus?.filename || filename
    : filename;

  // Compute rendered width
  const width = maximized ? '100%' : isOverlay ? '100%' : preferredWidth;
  const showSplitter = !isOverlay && !maximized;

  useEffect(() => {
    let cancelled = false;
    let interval: NodeJS.Timeout | null = null;

    const fetchStatus = async () => {
      try {
        const response = await fetch(resolve('documents', `/api/documents/${fileId}/status`), {
          headers: { 'X-Quiet-Logs': '1' },
        });
        if (!response.ok) return;
        const result = await response.json();
        if (cancelled) return;
        const data = result.data || result;
        setDocumentStatus(data);
        const nextStage = String(data?.status?.stage || '').toLowerCase();
        if (!ACTIVE_STAGES.has(nextStage) && nextStage !== 'available' && interval) {
          clearInterval(interval);
          interval = null;
        }
      } catch {
        /* HtmlViewer will render its own load/error state if status is unavailable. */
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, 5000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [fileId, resolve]);

  return (
    <aside
      className="relative flex h-full flex-shrink-0 flex-col border-l bg-[var(--marine-surface)]"
      style={{
        width,
        maxWidth: '100%',
        borderColor: 'var(--marine-border)',
        boxShadow: isOverlay
          ? '-16px 0 32px rgba(0,0,0,0.16)'
          : '-8px 0 24px rgba(0,0,0,0.04)',
        // Disable width transition while dragging so it tracks the pointer exactly.
        transition: dragging ? 'none' : 'width 260ms cubic-bezier(0.4,0,0.2,1)',
        position: isOverlay ? 'absolute' : 'relative',
        right: isOverlay ? 0 : undefined,
        top: isOverlay ? 0 : undefined,
        zIndex: isOverlay ? 30 : undefined,
      }}
    >
      {showSplitter && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize source panel"
          onPointerDown={onSplitterPointerDown}
          onPointerMove={onSplitterPointerMove}
          onPointerUp={onSplitterPointerUp}
          onPointerCancel={onSplitterPointerUp}
          className="group absolute left-0 top-0 z-10 flex h-full w-2 -translate-x-1 cursor-col-resize items-center justify-center"
          style={{ touchAction: 'none' }}
          title="Drag to resize"
        >
          <span
            className="pointer-events-none block h-full w-[2px] transition-colors"
            style={{
              backgroundColor: dragging ? 'var(--marine-teal)' : 'transparent',
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute h-8 w-[3px] rounded-full transition-colors group-hover:opacity-100"
            style={{
              backgroundColor: dragging ? 'var(--marine-teal)' : 'var(--marine-teal-muted)',
              opacity: dragging ? 1 : 0,
              transition: 'opacity 150ms ease-out, background-color 150ms',
            }}
          />
          {/* Hover-only hint (invisible when dragging) */}
          <span
            aria-hidden
            className="pointer-events-none absolute h-8 w-[3px] rounded-full opacity-0 transition-opacity group-hover:opacity-70"
            style={{ backgroundColor: 'var(--marine-teal-muted)' }}
          />
        </div>
      )}

      <div
        className="flex h-12 items-center justify-between border-b px-4"
        style={{ borderColor: 'var(--marine-border)' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--marine-teal)' }} />
          <span
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--marine-text)' }}
          >
            {displayFilename || 'Source Document'}{page ? ` — Page ${page}` : ''}
          </span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          <Tooltip label="Download">
            <a
              href={downloadHref}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-[var(--marine-teal-tint)]"
              style={{ borderColor: 'var(--marine-border)', color: 'var(--marine-text-body)' }}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
          </Tooltip>
          <Tooltip label={maximized ? 'Restore' : 'Maximize'}>
            <button
              type="button"
              onClick={toggleMax}
              aria-label={maximized ? 'Restore' : 'Maximize'}
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--marine-teal-tint)]"
              style={{ color: 'var(--marine-text-muted)' }}
            >
              {maximized ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
          <Tooltip label="Close">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--marine-teal-tint)]"
              style={{ color: 'var(--marine-text-muted)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        <HtmlViewer
          fileId={fileId}
          initialPage={page}
          isProcessing={isProcessing}
          isEnhancing={isEnhancing}
          processingStage={stage || undefined}
          statusMessage={status?.statusMessage || status?.errorMessage || undefined}
          pagesProcessed={status?.pagesProcessed ?? undefined}
          totalPages={status?.totalPages ?? undefined}
          progress={status?.progress ?? undefined}
        />
      </div>
    </aside>
  );
}
