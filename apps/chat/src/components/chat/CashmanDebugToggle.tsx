'use client';

/**
 * Debug-mode toggle — a small bug icon in the chat header that flips
 * `debugMode` on/off, persisted to localStorage so it survives reload.
 *
 * When on, CashmanMessages surfaces the underlying step timeline, thinking
 * stream, tool-call cards and routing decision payload for each assistant
 * message (and during streaming).
 */

import { useEffect, useState } from 'react';
import { Bug } from 'lucide-react';
import { Tooltip } from './Tooltip';

const STORAGE_KEY = 'cashman-debug-mode';

/** Hook: get + set debug mode with localStorage persistence. */
export function useDebugMode(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(false);

  // Load persisted value on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setEnabled(window.localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  const update = (v: boolean) => {
    setEnabled(v);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    }
  };

  return [enabled, update];
}

interface DebugToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function CashmanDebugToggle({ enabled, onToggle }: DebugToggleProps) {
  return (
    <Tooltip label={enabled ? 'Debug mode: on' : 'Debug mode: off'} side="bottom">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Toggle debug mode"
        aria-pressed={enabled}
        className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[#f5fbfb]"
        style={{
          color: enabled ? '#068284' : '#9ca3af',
          backgroundColor: enabled ? '#e6f4f4' : 'transparent',
          border: `1px solid ${enabled ? '#b8dede' : 'transparent'}`,
        }}
      >
        <Bug className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}
