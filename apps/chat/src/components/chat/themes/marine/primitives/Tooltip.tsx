'use client';

/**
 * Lightweight tooltip / preview popover.
 *
 * Renders the popover in a React portal on document.body so it isn't clipped
 * by ancestor overflow (e.g. the sidebar's scrollable list container).
 * Position is computed each hover from the trigger's bounding rect and pinned
 * with position: fixed.
 *
 * - `label` → dark chip
 * - `preview` → white/surface card (used for the collapsed sidebar's
 *   conversation-icon previews)
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label?: string;
  preview?: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
}

interface Position {
  top: number;
  left: number;
  transformOrigin: string;
}

export function Tooltip({ label, preview, side = 'top', children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position>({ top: 0, left: 0, transformOrigin: 'center' });

  // Only render the portal on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const pw = popover?.offsetWidth ?? (preview ? 260 : 120);
    const ph = popover?.offsetHeight ?? 32;
    const gap = 8;
    let top = 0;
    let left = 0;
    let origin = 'center';
    switch (side) {
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - pw / 2;
        origin = 'top center';
        break;
      case 'left':
        top = rect.top + rect.height / 2 - ph / 2;
        left = rect.left - pw - gap;
        origin = 'right center';
        break;
      case 'right':
        top = rect.top + rect.height / 2 - ph / 2;
        left = rect.right + gap;
        origin = 'left center';
        break;
      case 'top':
      default:
        top = rect.top - ph - gap;
        left = rect.left + rect.width / 2 - pw / 2;
        origin = 'bottom center';
        break;
    }
    // Clamp inside viewport (8px margin)
    const vpw = window.innerWidth;
    const vph = window.innerHeight;
    if (left < 8) left = 8;
    if (left + pw > vpw - 8) left = vpw - pw - 8;
    if (top < 8) top = 8;
    if (top + ph > vph - 8) top = vph - ph - 8;
    setPos({ top, left, transformOrigin: origin });
  }, [preview, side]);

  // Recompute when opening + on scroll/resize while open
  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
    const onScroll = () => computePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, computePosition]);

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    top: pos.top,
    left: pos.left,
    transformOrigin: pos.transformOrigin,
    opacity: open ? 1 : 0,
    transform: `scale(${open ? 1 : 0.96})`,
    transition: 'opacity 150ms ease-out, transform 150ms ease-out',
    pointerEvents: 'none',
    zIndex: 9999,
  };

  const popover = preview ? (
    <div
      ref={popoverRef}
      role="tooltip"
      aria-hidden={!open}
      className="rounded-lg border bg-[var(--marine-surface)] text-left shadow-lg"
      style={{
        ...popoverStyle,
        borderColor: 'var(--marine-border)',
        color: 'var(--marine-text)',
        width: 260,
        boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06)',
      }}
    >
      {preview}
    </div>
  ) : (
    <div
      ref={popoverRef}
      role="tooltip"
      aria-hidden={!open}
      className="whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium shadow-md"
      style={{
        ...popoverStyle,
        backgroundColor: 'var(--marine-green-dark)',
        color: '#ffffff',
      }}
    >
      {label}
    </div>
  );

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-flex"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={() => setOpen(false)}
      >
        {children}
      </span>
      {mounted && (label || preview) && createPortal(popover, document.body)}
    </>
  );
}
