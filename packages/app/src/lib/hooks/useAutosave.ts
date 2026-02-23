'use client';

import { useState, useRef, useCallback } from 'react';

/**
 * Autosave hook that saves on blur/change (not debounced on every keystroke).
 *
 * - Text inputs / textareas: call `markDirty()` on every onChange, then `triggerBlurSave()` on blur.
 * - Checkboxes / selects / color pickers: call `triggerSave()` directly on change.
 * - After a successful save, flashes the element border green via a CSS class.
 *
 * Consuming apps must include the `autosave-flash` CSS animation:
 * ```css
 * @keyframes autosave-flash {
 *   0%   { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.8); }
 *   100% { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0); }
 * }
 * .autosave-flash { animation: autosave-flash 1s ease-out; }
 * ```
 */
export function useAutosave<T extends object>(
  saveFn: (data: T) => Promise<boolean>,
) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState(false);
  const dirtyRef = useRef(false);
  const dataRef = useRef<T | null>(null);
  const inflight = useRef(false);

  const flashElement = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const target = el.closest('[data-autosave-group]') as HTMLElement | null ?? el;
    target.classList.remove('autosave-flash');
    void target.offsetWidth;
    target.classList.add('autosave-flash');
  }, []);

  const save = useCallback(async (data: T, el?: HTMLElement | null) => {
    if (inflight.current) return;
    inflight.current = true;
    setSaving(true);
    setError(null);
    setLastSaved(false);
    try {
      const ok = await saveFn(data);
      if (ok) {
        setLastSaved(true);
        if (el) flashElement(el);
        setTimeout(() => setLastSaved(false), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
      inflight.current = false;
      dirtyRef.current = false;
    }
  }, [saveFn, flashElement]);

  const markDirty = useCallback((data: T) => {
    dirtyRef.current = true;
    dataRef.current = data;
  }, []);

  const triggerSave = useCallback((data: T, el?: HTMLElement | null) => {
    void save(data, el);
  }, [save]);

  const triggerBlurSave = useCallback((el?: HTMLElement | null) => {
    if (dirtyRef.current && dataRef.current) {
      void save(dataRef.current, el);
    }
  }, [save]);

  return {
    saving,
    error,
    lastSaved,
    setError,
    markDirty,
    triggerSave,
    triggerBlurSave,
  };
}
