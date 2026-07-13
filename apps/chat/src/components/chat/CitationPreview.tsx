'use client';

/**
 * Citation preview card — the popover shown on hover of a citation superscript.
 * Contains: file icon + filename + page badge, quoted snippet, small caps footer.
 */

import { FileText } from 'lucide-react';

export interface CitationPreviewData {
  filename: string;
  page?: number;
  snippet: string;
  effectiveLabel?: string;
}

interface CitationPreviewProps {
  open: boolean;
  data: CitationPreviewData;
  /** Preview horizontal alignment relative to the citation chip. */
  align?: 'left' | 'right';
}

export function CitationPreview({ open, data, align = 'left' }: CitationPreviewProps) {
  return (
    <div
      className="pointer-events-none absolute z-50 rounded-lg border bg-[var(--cashman-surface)] shadow-lg"
      style={{
        bottom: 'calc(100% + 10px)',
        left: align === 'left' ? 0 : 'auto',
        right: align === 'right' ? 0 : 'auto',
        width: 320,
        borderColor: 'var(--cashman-border)',
        boxShadow: '0 8px 24px rgba(15,62,24,0.10), 0 2px 6px rgba(0,0,0,0.04)',
        opacity: open ? 1 : 0,
        transform: `translateY(${open ? '0' : '4px'})`,
        transition: 'opacity 160ms ease-out, transform 160ms ease-out',
      }}
    >
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--cashman-teal)' }} />
          <span
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--cashman-text)' }}
          >
            {data.filename}
          </span>
        </div>
        {data.page !== undefined && (
          <span
            className="flex-shrink-0 text-xs font-medium"
            style={{ color: 'var(--cashman-text-muted)' }}
          >
            p.{data.page}
          </span>
        )}
      </div>

      <div className="border-t px-4 py-3" style={{ borderColor: 'var(--cashman-border)' }}>
        <p
          className="text-sm leading-[22px]"
          style={{ color: 'var(--cashman-text-body)' }}
        >
          &ldquo;{data.snippet}&rdquo;
        </p>
      </div>

      {data.effectiveLabel && (
        <div
          className="border-t px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
          style={{
            borderColor: 'var(--cashman-border)',
            color: 'var(--cashman-text-subtle)',
            letterSpacing: '0.08em',
          }}
        >
          {data.effectiveLabel}
        </div>
      )}

      {/* Small pointer tail */}
      <span
        aria-hidden
        className="absolute h-2 w-2 rotate-45 border-b border-r bg-[var(--cashman-surface)]"
        style={{
          bottom: -5,
          left: align === 'left' ? 12 : 'auto',
          right: align === 'right' ? 12 : 'auto',
          borderColor: 'var(--cashman-border)',
        }}
      />
    </div>
  );
}
