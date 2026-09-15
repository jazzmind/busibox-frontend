'use client';

/**
 * Quick-reply chips shown above the composer when the assistant ends its
 * turn with a question that has a bounded set of answers (e.g. the deep
 * research offer "Would you like me to run it?" → Yes / No).
 *
 * The options come from the agent's clarify event (`data.options`) via
 * useChatStream's `quickReplies` / `promptActive` state. Clicking a chip
 * sends that text as the next user message.
 */

import { Check, X } from 'lucide-react';

interface MarineQuickRepliesProps {
  replies: string[];
  onSelect: (reply: string) => void;
  disabled?: boolean;
}

const AFFIRMATIVE = new Set(['yes', 'y', 'ok', 'okay', 'sure', 'proceed', 'go ahead', 'continue']);
const NEGATIVE = new Set(['no', 'n', 'cancel', 'skip', 'not now']);

function iconFor(reply: string) {
  const key = reply.trim().toLowerCase();
  if (AFFIRMATIVE.has(key)) return <Check className="h-3.5 w-3.5" />;
  if (NEGATIVE.has(key)) return <X className="h-3.5 w-3.5" />;
  return null;
}

export function MarineQuickReplies({ replies, onSelect, disabled }: MarineQuickRepliesProps) {
  if (replies.length === 0) return null;

  return (
    <div
      className="mx-auto flex w-full max-w-[820px] flex-wrap items-center gap-2 px-5 pt-1"
      role="group"
      aria-label="Suggested replies"
    >
      {replies.map((reply) => {
        const key = reply.trim().toLowerCase();
        const primary = AFFIRMATIVE.has(key);
        return (
          <button
            key={reply}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(reply)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-all hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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
            {reply}
          </button>
        );
      })}
    </div>
  );
}
