'use client';

/**
 * useSmoothedText — client-side token smoothing.
 *
 * SSE chunks arrive in bursts (a few hundred chars at once, then nothing for
 * 300 ms). Rendering each burst as-is makes the text stutter. This hook keeps
 * a "revealed" copy of the target string and advances it every animation
 * frame at a rate proportional to the backlog, so output looks like steady
 * typing regardless of how the network delivers it.
 *
 * - `active=false` (stream finished / cancelled) flushes to the full text.
 * - If the target is replaced rather than extended (an interim answer swapped
 *   for the final one), the revealed text snaps to the common prefix and keeps
 *   going from there.
 */

import { useEffect, useRef, useState } from 'react';

const MIN_CHARS_PER_FRAME = 2;
const MAX_CHARS_PER_FRAME = 120;
/** Fraction of the backlog to drain per frame — higher = catches up faster. */
const DRAIN_RATIO = 0.08;
/** If we start with nothing shown and this much already exists, don't animate it. */
const SNAP_THRESHOLD = 1500;

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

export function useSmoothedText(target: string, active: boolean): string {
  const [revealed, setRevealed] = useState(target);
  const revealedRef = useRef(target);
  const targetRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  targetRef.current = target;

  useEffect(() => {
    if (!active) {
      revealedRef.current = target;
      setRevealed(target);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // Target diverged from what we've shown (replacement, not append): snap
    // back to the shared prefix so we never display text that no longer exists.
    if (!target.startsWith(revealedRef.current)) {
      const keep = commonPrefixLength(target, revealedRef.current);
      revealedRef.current = target.slice(0, keep);
      setRevealed(revealedRef.current);
    }

    // Reattaching to a turn that already produced a lot of text (page reload,
    // laptop woke up): show what exists immediately, animate only the rest.
    if (revealedRef.current === '' && target.length > SNAP_THRESHOLD) {
      revealedRef.current = target;
      setRevealed(target);
    }

    const tick = () => {
      const goal = targetRef.current;
      const shown = revealedRef.current;
      if (shown.length >= goal.length) {
        rafRef.current = null;
        return;
      }
      const backlog = goal.length - shown.length;
      const step = Math.min(
        MAX_CHARS_PER_FRAME,
        Math.max(MIN_CHARS_PER_FRAME, Math.ceil(backlog * DRAIN_RATIO)),
      );
      const next = goal.slice(0, shown.length + step);
      revealedRef.current = next;
      setRevealed(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, active]);

  return active ? revealed : target;
}
