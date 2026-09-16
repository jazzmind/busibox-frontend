'use client';

/**
 * Quick-reply chips shown above the composer when the assistant ends its
 * turn with a question that has a bounded set of answers:
 *
 *   - confirm  → "Would you like me to run it?"  ⇒  [✓ Yes] [✕ No]
 *   - choice   → "Which project do you mean?"    ⇒  [Boston Harbor] [C&D Canal] [Something else…]
 *
 * Options come from the agent's `prompt` / `clarify_parallel` events
 * (`data.options`, `data.prompt_type`) via useChatStream. Clicking a chip
 * sends its text as the next user message; "Something else…" dismisses the
 * chips and focuses the composer so the user can type their own answer.
 */

import { Check, PenLine, X } from 'lucide-react';

interface MarineQuickRepliesProps {
  replies: string[];
  onSelect: (reply: string) => void;
  /** Shown for choice prompts; dismisses the chips and focuses the composer. */
  onOther?: () => void;
  /** From the agent's `prompt` event. Falls back to a yes/no heuristic when absent. */
  mode?: 'confirm' | 'choice' | 'open';
  disabled?: boolean;
}

const AFFIRMATIVE = new Set(['yes', 'y', 'ok', 'okay', 'sure', 'proceed', 'go ahead', 'continue']);
const NEGATIVE = new Set(['no', 'n', 'cancel', 'skip', 'not now']);

function isConfirmSet(replies: string[]): boolean {
  return replies.every((r) => {
    const k = r.trim().toLowerCase();
    return AFFIRMATIVE.has(k) || NEGATIVE.has(k);
  });
}

function iconFor(reply: string) {
  const key = reply.trim().toLowerCase();
  if (AFFIRMATIVE.has(key)) return <Check className="h-3.5 w-3.5" />;
  if (NEGATIVE.has(key)) return <X className="h-3.5 w-3.5" />;
  return null;
}

export function MarineQuickReplies({ replies, onSelect, onOther, mode, disabled }: MarineQuickRepliesProps) {
  if (replies.length === 0) return null;
  const confirm = mode ? mode === 'confirm' : isConfirmSet(replies);

  return (
    <div
      className="mx-auto flex w-full max-w-[820px] flex-wrap items-center gap-2 px-5 pt-1"
      role="group"
      aria-label="Suggested replies"
    >
      {replies.map((reply, idx) => {
        const key = reply.trim().toLowerCase();
        // Confirm sets highlight the affirmative; choice sets highlight the first option.
        const primary = confirm ? AFFIRMATIVE.has(key) : idx === 0;
        return (
          <button
            key={reply}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(reply)}
            className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-all hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={
              primary
                ? {
                    backgroundColor: 'var(--marine-teal)',
                    borderColor: 'var(--marine-teal)',
                    color: '#ffffff',
                  }
                : {
                    backgroundColor: 'var(--marine-surface)',
                    borderColor: 'var(--marine-teal-border)',
                    color: 'var(--marine-teal-dark)',
                  }
            }
          >
            {iconFor(reply)}
            <span className="truncate">{reply}</span>
          </button>
        );
      })}
      {!confirm && onOther && (
        <button
          type="button"
          disabled={disabled}
          onClick={onOther}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed px-3.5 text-[13px] font-medium transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
          style={{
            backgroundColor: 'transparent',
            borderColor: 'var(--marine-border-strong)',
            color: 'var(--marine-text-muted)',
          }}
        >
          <PenLine className="h-3.5 w-3.5" />
          Something else…
        </button>
      )}
    </div>
  );
}
