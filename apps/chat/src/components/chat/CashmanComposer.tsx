'use client';

import { useRef, useState, useEffect, KeyboardEvent } from 'react';
import { Paperclip, Mic, Send, Square } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface CashmanComposerProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function CashmanComposer({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  placeholder = 'Ask Cashman anything',
}: CashmanComposerProps) {
  const [content, setContent] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [content]);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setContent('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasContent = content.trim().length > 0;

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col items-center px-5 pb-4 pt-3">
      <div
        className="w-full rounded-[14px] p-px"
        style={{
          backgroundColor: 'var(--cashman-teal)',
          boxShadow: focused
            ? '0 12px 24px rgba(6,130,132,0.22)'
            : '0 10px 16px rgba(6,130,132,0.12)',
          transition: 'box-shadow 200ms ease-out',
        }}
      >
        <div
          className="flex items-center gap-3 rounded-[13px] px-4 py-2"
          style={{ backgroundColor: 'var(--cashman-teal-tint)' }}
        >
          <Tooltip label="Attach a file">
            <button
              type="button"
              aria-label="Attach"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--cashman-teal-light)]"
              style={{ color: 'var(--cashman-text-muted)' }}
            >
              <Paperclip className="h-5 w-5" />
            </button>
          </Tooltip>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className="min-h-[24px] max-h-[200px] flex-1 resize-none border-0 py-2 text-base outline-none placeholder:text-[var(--cashman-text-muted)]"
            style={{
              color: 'var(--cashman-text)',
              // Inline background wins over the `.dark textarea` rule in
              // globals.css that would otherwise force gray-900 here.
              backgroundColor: 'transparent',
              border: 'none',
              boxShadow: 'none',
            }}
          />

          <div className="flex flex-shrink-0 items-center gap-2">
            <Tooltip label="Voice input">
              <button
                type="button"
                aria-label="Voice"
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--cashman-teal-light)]"
                style={{ color: 'var(--cashman-text-muted)' }}
              >
                <Mic className="h-5 w-5" />
              </button>
            </Tooltip>

            {isStreaming && onStop ? (
              <Tooltip label="Stop generating">
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: 'var(--cashman-teal)',
                    boxShadow: '0 5px 7px rgba(6,130,132,0.25)',
                  }}
                >
                  <Square className="h-4 w-4" />
                </button>
              </Tooltip>
            ) : (
              <Tooltip label={hasContent ? 'Send message' : 'Type a message'}>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!hasContent || disabled}
                  aria-label="Send"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-all disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100 active:scale-95"
                  style={{
                    backgroundColor: hasContent && !disabled ? 'var(--cashman-teal)' : 'var(--cashman-teal-muted)',
                    boxShadow:
                      hasContent && !disabled
                        ? '0 5px 7px rgba(6,130,132,0.25)'
                        : 'none',
                  }}
                >
                  <Send className="h-[18px] w-[18px]" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      <p
        className="pt-3 text-center text-[11px] leading-4"
        style={{ color: 'var(--cashman-text-muted)' }}
      >
        Cashman AI can make mistakes. Check the responses.
      </p>
    </div>
  );
}
