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
 * Backend document fetch is a follow-up; body is a Figma-6301 placeholder.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FileText,
  Download,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { Tooltip } from './Tooltip';

interface SourcePanelProps {
  fileId: string;
  page?: number;
  filename?: string;
  onClose: () => void;
  onMaximizedChange?: (maximized: boolean) => void;
}

const PLACEHOLDER_TOC = [
  { id: 'title', label: 'Cashman Companies 2026 Holiday Schedule' },
  {
    id: 'observance',
    label:
      'Jay Cashman, Inc. and Affiliate Companies will observe the following Holiday Schedule:',
  },
  {
    id: 'eligibility',
    label:
      'Any employee who requests time off from work to observe a holiday not regularly observed',
  },
  {
    id: 'vacation',
    label: 'by the Company is eligible to use any accrued vacation time.',
  },
];

const WIDTH_STORAGE_KEY = 'cashman-source-width';
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

export function CashmanSourcePanel({
  fileId,
  page,
  filename = 'Source Document',
  onClose,
  onMaximizedChange,
}: SourcePanelProps) {
  const [maximized, setMaximized] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  );
  const [preferredWidth, setPreferredWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
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

  // Compute rendered width
  const width = maximized ? '100%' : isOverlay ? '100%' : preferredWidth;
  const showSplitter = !isOverlay && !maximized;

  return (
    <aside
      className="relative flex h-full flex-shrink-0 flex-col border-l bg-white"
      style={{
        width,
        maxWidth: '100%',
        borderColor: '#ebebeb',
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
              backgroundColor: dragging ? '#068284' : 'transparent',
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute h-8 w-[3px] rounded-full transition-colors group-hover:opacity-100"
            style={{
              backgroundColor: dragging ? '#068284' : '#94b8b9',
              opacity: dragging ? 1 : 0,
              transition: 'opacity 150ms ease-out, background-color 150ms',
            }}
          />
          {/* Hover-only hint (invisible when dragging) */}
          <span
            aria-hidden
            className="pointer-events-none absolute h-8 w-[3px] rounded-full opacity-0 transition-opacity group-hover:opacity-70"
            style={{ backgroundColor: '#94b8b9' }}
          />
        </div>
      )}

      <div
        className="flex h-12 items-center justify-between border-b px-4"
        style={{ borderColor: '#ebebeb' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-5 w-5 flex-shrink-0" style={{ color: '#068284' }} />
          <span
            className="truncate text-sm font-semibold"
            style={{ color: '#101828' }}
          >
            Source Document{page ? ` — Page ${page}` : ''}
          </span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          <Tooltip label="Download">
            <a
              href={downloadHref}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-[#f5fbfb]"
              style={{ borderColor: '#ebebeb', color: '#393a3d' }}
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
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[#f5fbfb]"
              style={{ color: '#6b6c72' }}
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
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[#f5fbfb]"
              style={{ color: '#6b6c72' }}
            >
              <X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden p-5">
        {/* Table of contents — hide when the panel is very narrow so the doc body has room. */}
        {(maximized || preferredWidth >= 520) && !isOverlay && (
          <div
            className="w-56 flex-shrink-0 self-start rounded-md border p-3"
            style={{ borderColor: '#ebebeb', backgroundColor: '#fbfbfb' }}
          >
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: '#068284' }} />
              <span
                className="text-sm font-semibold"
                style={{ color: '#101828' }}
              >
                Table of Contents
              </span>
            </div>
            <ul className="space-y-3">
              {PLACEHOLDER_TOC.map((item) => (
                <li
                  key={item.id}
                  className="text-xs leading-[18px]"
                  style={{ color: '#393a3d' }}
                >
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="flex items-center justify-center pb-4">
            <div
              className="rounded-md px-6 py-3 text-2xl font-black tracking-widest"
              style={{ backgroundColor: '#e6f4f4', color: '#0f3e18' }}
            >
              CASHMAN
            </div>
          </div>

          <h1
            className="pb-4 text-2xl font-bold"
            style={{ color: '#101828' }}
          >
            {filename === 'Source Document'
              ? 'Cashman Companies 2026 Holiday Schedule'
              : filename}
          </h1>

          <div className="space-y-2 pb-6 text-sm" style={{ color: '#101828' }}>
            <p className="font-semibold">
              Jay Cashman, Inc. and Affiliate Companies will observe the following
              Holiday Schedule:
            </p>
          </div>

          <div className="space-y-4 text-sm" style={{ color: '#393a3d' }}>
            {[
              ["New Year's Day", 'Thursday, January 1st'],
              ['Presidents Day', 'Monday, February 16th'],
              ['Memorial Day', 'Monday, May 25th'],
              ['Independence Day', 'Friday, July 3rd (Observed)'],
              ['Labor Day', 'Monday, September 7th'],
              ['Thanksgiving Day', 'Thursday, November 26th'],
              ['Day after Thanksgiving', 'Friday, November 27th'],
              ['Christmas Eve', 'Thursday, December 24th'],
              ['Christmas Day', 'Friday, December 25th'],
            ].map(([name, date]) => (
              <div key={name}>
                <p className="font-semibold" style={{ color: '#101828' }}>
                  {name}
                </p>
                <p>{date}</p>
              </div>
            ))}
          </div>

          <p
            className="pt-8 text-xs italic"
            style={{ color: '#6b6c72' }}
          >
            Live document content will render here once the source viewer is wired to
            the data API (file <code>{fileId}</code>
            {page ? `, page ${page}` : ''}).
          </p>
        </div>
      </div>
    </aside>
  );
}
