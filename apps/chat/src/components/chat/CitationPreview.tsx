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
      className="pointer-events-none absolute z-50 rounded-lg border bg-white shadow-lg"
      style={{
        bottom: 'calc(100% + 10px)',
        left: align === 'left' ? 0 : 'auto',
        right: align === 'right' ? 0 : 'auto',
        width: 320,
        borderColor: '#ebebeb',
        boxShadow: '0 8px 24px rgba(15,62,24,0.10), 0 2px 6px rgba(0,0,0,0.04)',
        opacity: open ? 1 : 0,
        transform: `translateY(${open ? '0' : '4px'})`,
        transition: 'opacity 160ms ease-out, transform 160ms ease-out',
      }}
    >
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: '#068284' }} />
          <span
            className="truncate text-sm font-semibold"
            style={{ color: '#101828' }}
          >
            {data.filename}
          </span>
        </div>
        {data.page !== undefined && (
          <span
            className="flex-shrink-0 text-xs font-medium"
            style={{ color: '#6b6c72' }}
          >
            p.{data.page}
          </span>
        )}
      </div>

      <div className="border-t px-4 py-3" style={{ borderColor: '#ebebeb' }}>
        <p
          className="text-sm leading-[22px]"
          style={{ color: '#393a3d' }}
        >
          &ldquo;{data.snippet}&rdquo;
        </p>
      </div>

      {data.effectiveLabel && (
        <div
          className="border-t px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
          style={{
            borderColor: '#ebebeb',
            color: '#9ca3af',
            letterSpacing: '0.08em',
          }}
        >
          {data.effectiveLabel}
        </div>
      )}

      {/* Small pointer tail */}
      <span
        aria-hidden
        className="absolute h-2 w-2 rotate-45 border-b border-r bg-white"
        style={{
          bottom: -5,
          left: align === 'left' ? 12 : 'auto',
          right: align === 'right' ? 12 : 'auto',
          borderColor: '#ebebeb',
        }}
      />
    </div>
  );
}
