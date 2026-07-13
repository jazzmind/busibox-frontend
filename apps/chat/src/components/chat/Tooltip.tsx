'use client';

/**
 * Lightweight tooltip — no animation library, no portal.
 * Wraps a single child (usually a button) and shows a dark teal tooltip on hover/focus.
 *
 * When `preview` is provided instead of `label`, renders a larger card-style popover
 * with rich content (icon, title, description). Preview mode uses a white card so it
 * reads like a mini info panel rather than a dark chip.
 */

import { useState, ReactNode, cloneElement, isValidElement } from 'react';

interface TooltipProps {
  label?: string;
  preview?: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
}

export function Tooltip({ label, preview, side = 'top', children }: TooltipProps) {
  const [open, setOpen] = useState(false);

  if (!isValidElement(children)) {
    return <>{children}</>;
  }

  const positionStyle: React.CSSProperties = (() => {
    switch (side) {
      case 'bottom':
        return {
          top: 'calc(100% + 6px)',
          left: '50%',
          transform: `translateX(-50%) translateY(${open ? '0' : '-2px'})`,
        };
      case 'left':
        return {
          right: 'calc(100% + 8px)',
          top: '50%',
          transform: `translateY(-50%) translateX(${open ? '0' : '2px'})`,
        };
      case 'right':
        return {
          left: 'calc(100% + 8px)',
          top: '50%',
          transform: `translateY(-50%) translateX(${open ? '0' : '-2px'})`,
        };
      case 'top':
      default:
        return {
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: `translateX(-50%) translateY(${open ? '0' : '2px'})`,
        };
    }
  })();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      {preview ? (
        <span
          role="tooltip"
          aria-hidden={!open}
          className="pointer-events-none absolute z-50 rounded-lg border bg-white text-left shadow-lg"
          style={{
            ...positionStyle,
            borderColor: '#ebebeb',
            color: '#101828',
            width: 260,
            opacity: open ? 1 : 0,
            boxShadow: '0 8px 24px rgba(15,62,24,0.10), 0 2px 6px rgba(0,0,0,0.04)',
            transition: 'opacity 160ms ease-out, transform 160ms ease-out',
          }}
        >
          {preview}
        </span>
      ) : (
        <span
          role="tooltip"
          aria-hidden={!open}
          className="pointer-events-none absolute z-50 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium shadow-md"
          style={{
            ...positionStyle,
            backgroundColor: '#0f3e18',
            color: '#ffffff',
            opacity: open ? 1 : 0,
            transition: 'opacity 150ms ease-out, transform 150ms ease-out',
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
