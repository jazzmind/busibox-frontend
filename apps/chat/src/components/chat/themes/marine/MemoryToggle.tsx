'use client';

/** Header button that opens the Memory panel (what the assistant knows about you). */

import { Brain } from 'lucide-react';
import { Tooltip } from './primitives/Tooltip';

interface MemoryToggleProps {
  open: boolean;
  onToggle: () => void;
}

export function MarineMemoryToggle({ open, onToggle }: MemoryToggleProps) {
  const label = open ? 'Close your memory' : 'Your memory — what the assistant knows about you';
  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-pressed={open}
        className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--marine-teal-tint)]"
        style={{
          color: open ? 'var(--marine-teal)' : 'var(--marine-text-subtle)',
          backgroundColor: open ? 'var(--marine-teal-light)' : 'transparent',
          border: `1px solid ${open ? 'var(--marine-teal-border)' : 'transparent'}`,
        }}
      >
        <Brain className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}
