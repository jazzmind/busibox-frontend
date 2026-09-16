'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  FileText,
  Paperclip,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Download,
  Check,
} from 'lucide-react';
import type {
  Message,
  MessageCitation,
  ThoughtEvent,
  MessagePart,
} from '@jazzmind/busibox-app/types/chat';
import { Tooltip } from './primitives/Tooltip';
import { CitationPreview, type CitationPreviewData } from './primitives/CitationPreview';
import { MarineDebugPanel } from './DebugPanel';
import { MarineAttachmentStatus } from './AttachmentStatus';
import { MarineActivityStatus } from './ActivityStatus';
import { StreamedMarkdown } from './StreamedMarkdown';
import { useSmoothedText } from './hooks/useSmoothedText';

const DOC_LINK_RE = /^doc:([^:]+)(?::(\d+))?$/;

export type CitationPreviewLookup = (
  fileId: string,
  page?: number,
) => CitationPreviewData | undefined;

interface MarineMessagesProps {
  messages: Message[];
  streamingContent?: string;
  streamingCitations?: MessageCitation[];
  streamingThoughts?: ThoughtEvent[];
  streamingParts?: MessagePart[];
  streamingAgentName?: string;
  isLoading?: boolean;
  activeCitation?: { fileId: string; page?: number } | null;
  onCitationClick: (fileId: string, page?: number) => void;
  /** Optional hover-preview data for a given citation. If omitted, no preview shows. */
  getCitationPreview?: CitationPreviewLookup;
  /** When true, render debug panels (step timeline, thoughts, tool cards, routing). */
  debugMode?: boolean;
}

interface CitationChipProps {
  index: number;
  label: React.ReactNode;
  preview?: CitationPreviewData;
  onClick: () => void;
}

function CitationChip({ index, label, preview, onClick }: CitationChipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[6px] px-1 text-[10px] font-semibold transition-colors hover:brightness-95"
        style={{ backgroundColor: 'var(--marine-teal-light)', color: 'var(--marine-teal-dark)' }}
        aria-label="View source"
      >
        {index > 0 ? index : label}
      </button>
      {preview && <CitationPreview open={open} data={preview} />}
    </span>
  );
}

function makeCitationRenderer(
  citations: MessageCitation[] | undefined,
  onCitationClick: (fileId: string, page?: number) => void,
  getCitationPreview?: CitationPreviewLookup,
) {
  return function CitationAnchor({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    if (href) {
      const match = DOC_LINK_RE.exec(href);
      if (match) {
        const fileId = match[1];
        const page = match[2] ? parseInt(match[2], 10) : undefined;
        const idx =
          (citations || []).findIndex(
            (c) => c.fileId === fileId && (page === undefined || c.page === page),
          ) + 1;
        const citation = (citations || []).find(
          (c) => c.fileId === fileId && (page === undefined || c.page === page),
        );
        const preview = getCitationPreview?.(fileId, page) ||
          (citation?.snippet
            ? {
                filename: citation.filename || 'Source',
                page: citation.page,
                snippet: citation.snippet,
                effectiveLabel: citation.source,
              }
            : undefined);
        return (
          <sup>
            <CitationChip
              index={idx}
              label={children}
              preview={preview}
              onClick={() => onCitationClick(fileId, page)}
            />
          </sup>
        );
      }
    }
    return (
      <a
        {...rest}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--marine-teal)' }}
      >
        {children}
      </a>
    );
  };
}

interface SourcePillsProps {
  citations: MessageCitation[];
  activeCitation: { fileId: string; page?: number } | null;
  onCitationClick: (fileId: string, page?: number) => void;
}

function SourcePills({ citations, activeCitation, onCitationClick }: SourcePillsProps) {
  if (!citations.length) return null;
  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3"
      style={{ borderColor: 'var(--marine-border)' }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: 'var(--marine-text-subtle)', letterSpacing: '0.08em' }}
      >
        Sources
      </span>
      {citations.map((c, idx) => {
        const isActive =
          activeCitation &&
          activeCitation.fileId === c.fileId &&
          (activeCitation.page ?? undefined) === (c.page ?? undefined);
        const label = `${c.filename || 'Source'}${c.page ? ` · p.${c.page}` : ''}`;
        return (
          <button
            key={`${c.fileId}-${c.page ?? idx}`}
            type="button"
            onClick={() => onCitationClick(c.fileId, c.page)}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all hover:brightness-95 active:scale-[0.98]"
            style={{
              borderColor: isActive ? 'var(--marine-teal)' : 'var(--marine-border)',
              backgroundColor: isActive ? 'var(--marine-teal-light)' : 'var(--marine-surface)',
              color: isActive ? 'var(--marine-teal-dark)' : 'var(--marine-text-body)',
            }}
          >
            <FileText className="h-3.5 w-3.5" style={{ color: 'var(--marine-teal)' }} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function SourcePlaceholder() {
  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3"
      style={{ borderColor: 'var(--marine-border)' }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: 'var(--marine-text-subtle)', letterSpacing: '0.08em' }}
      >
        Sources
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium"
        style={{
          borderColor: 'var(--marine-border)',
          backgroundColor: 'var(--marine-surface)',
          color: 'var(--marine-text-subtle)',
        }}
      >
        <FileText className="h-3.5 w-3.5" style={{ color: 'var(--marine-text-subtle)' }} />
        Sources pending
      </span>
    </div>
  );
}

function AttachmentPills({ attachments }: { attachments: NonNullable<Message['attachments']> }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-2 flex flex-wrap justify-end gap-2">
      {attachments.map((attachment) => (
        <MarineAttachmentStatus
          key={attachment.id}
          attachment={attachment}
          align="right"
        />
      ))}
    </div>
  );
}

interface MessageActionsProps {
  content: string;
}

function MessageActions({ content }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<'up' | 'down' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat-response.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const buttonClass =
    'flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--marine-teal-tint)]';

  return (
    <div className="mt-2 flex items-center gap-1">
      <Tooltip label="Helpful">
        <button
          type="button"
          onClick={() => setVote(vote === 'up' ? null : 'up')}
          className={buttonClass}
          style={{ color: vote === 'up' ? 'var(--marine-teal-dark)' : 'var(--marine-text-subtle)' }}
          aria-label="Helpful"
          aria-pressed={vote === 'up'}
        >
          <ThumbsUp className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip label="Not helpful">
        <button
          type="button"
          onClick={() => setVote(vote === 'down' ? null : 'down')}
          className={buttonClass}
          style={{ color: vote === 'down' ? 'var(--marine-error)' : 'var(--marine-text-subtle)' }}
          aria-label="Not helpful"
          aria-pressed={vote === 'down'}
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip label={copied ? 'Copied' : 'Copy'}>
        <button
          type="button"
          onClick={handleCopy}
          className={buttonClass}
          style={{ color: copied ? 'var(--marine-teal-dark)' : 'var(--marine-text-subtle)' }}
          aria-label="Copy"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </Tooltip>
      <Tooltip label="Download as Markdown">
        <button
          type="button"
          onClick={handleDownload}
          className={buttonClass}
          style={{ color: 'var(--marine-text-subtle)' }}
          aria-label="Download"
        >
          <Download className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );
}

interface AssistantMessageProps {
  message: Message;
  isLast: boolean;
  debugMode: boolean;
  activeCitation: { fileId: string; page?: number } | null;
  onCitationClick: (fileId: string, page?: number) => void;
  getCitationPreview?: CitationPreviewLookup;
}

const AssistantMessage = memo(function AssistantMessage({
  message,
  isLast,
  debugMode,
  activeCitation,
  onCitationClick,
  getCitationPreview,
}: AssistantMessageProps) {
  const components = useMemo(
    () => ({ a: makeCitationRenderer(message.citations, onCitationClick, getCitationPreview) }),
    [message.citations, onCitationClick, getCitationPreview],
  );
  const m = message as Message & {
    agentName?: string;
    model?: string;
    thoughts?: ThoughtEvent[];
    parts?: MessagePart[];
    routingDecision?: unknown;
  };

  return (
    <div
      className="flex flex-col items-start"
      style={{
        animation: isLast ? 'marineFadeSlideUp 260ms cubic-bezier(0.4,0,0.2,1)' : undefined,
      }}
    >
      {debugMode && (
        <div className="w-full max-w-none">
          <MarineDebugPanel
            agentName={m.agentName}
            model={m.model}
            thoughts={m.thoughts}
            parts={m.parts}
            routingDecision={m.routingDecision as any}
          />
        </div>
      )}
      <MarineActivityStatus thoughts={m.thoughts} parts={m.parts} active={false} hasContent />
      <div className="prose max-w-none text-[15px] leading-[26px]" style={{ color: 'var(--marine-text)' }}>
        <StreamedMarkdown content={message.content} components={components} />
      </div>

      {message.citations && message.citations.length > 0 ? (
        <SourcePills
          citations={dedupeCitations(message.citations)}
          activeCitation={activeCitation}
          onCitationClick={onCitationClick}
        />
      ) : (
        <SourcePlaceholder />
      )}

      <MessageActions content={message.content} />
    </div>
  );
});

/** Pixels from the bottom within which we consider the user "at the bottom". */
const STICK_THRESHOLD = 96;

export function MarineMessages({
  messages,
  streamingContent,
  streamingCitations,
  streamingThoughts,
  streamingParts,
  streamingAgentName,
  isLoading,
  activeCitation = null,
  onCitationClick,
  getCitationPreview,
  debugMode = false,
}: MarineMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  // True while the view should follow new content. Cleared when the user
  // scrolls up; restored when they scroll back to the bottom, send a message,
  // or press the jump button.
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const active = !!isLoading;
  const smoothedContent = useSmoothedText(streamingContent ?? '', active);
  const hasStreamText = smoothedContent.length > 0;

  // When the turn started — drives the elapsed counter in the status line.
  const startedAtRef = useRef<number | undefined>(undefined);
  if (active && startedAtRef.current === undefined) startedAtRef.current = Date.now();
  if (!active) startedAtRef.current = undefined;

  const streamingComponents = useMemo(
    () => ({ a: makeCitationRenderer(streamingCitations, onCitationClick, getCitationPreview) }),
    [streamingCitations, onCitationClick, getCitationPreview],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior });
  }, []);

  // Find the scroll container once and watch the user's scrolling.
  //
  // Only *user-initiated* scrolling (wheel, touch, keyboard) can switch
  // following off — our own scrollTo() calls also fire `scroll` events while
  // a smooth scroll animates, and treating those as intent would turn
  // following off the moment we tried to follow. The plain `scroll` handler
  // may only switch following back on once the user reaches the bottom.
  useEffect(() => {
    const scroller = endRef.current?.closest<HTMLElement>('[data-chat-scroll="1"]') ?? null;
    scrollerRef.current = scroller;
    if (!scroller) return;
    const distanceFromBottom = () =>
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    const canScroll = () => scroller.scrollHeight - scroller.clientHeight > STICK_THRESHOLD;
    let userScrolledUpAt = 0;
    const onScroll = () => {
      // Brief cooldown so the first notch of an upward scroll (still within
      // the threshold) isn't immediately undone by this handler.
      if (Date.now() - userScrolledUpAt < 300) return;
      if (distanceFromBottom() <= STICK_THRESHOLD) {
        stickRef.current = true;
        setShowJump(false);
      }
    };
    const onUserScrollUp = () => {
      // Called synchronously on the input event, before the scroll position
      // changes, so check direction of intent rather than position.
      if (!canScroll() || scroller.scrollTop === 0) return;
      userScrolledUpAt = Date.now();
      stickRef.current = false;
      setShowJump(true);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) onUserScrollUp();
    };
    const onKey = (e: KeyboardEvent) => {
      // Keyboard scrolling targets the last-clicked scroller even when focus
      // is on <body>, so listen on window; ignore typing in the composer.
      const target = e.target as HTMLElement | null;
      if (target?.closest('input,textarea,[contenteditable="true"]')) return;
      if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home') onUserScrollUp();
    };
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      if (y - touchStartY > 8) onUserScrollUp();
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKey);
    scroller.addEventListener('touchstart', onTouchStart, { passive: true });
    scroller.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // A new user message always re-engages following (they just sent it).
  const lastMessage = messages[messages.length - 1];
  useEffect(() => {
    if (lastMessage?.role === 'user') {
      stickRef.current = true;
      setShowJump(false);
      scrollToBottom('smooth');
    }
  }, [lastMessage?.id, lastMessage?.role, scrollToBottom]);

  // Follow streamed text with instant scrolls (smooth scrolling every frame
  // never finishes and fights the user's wheel).
  useEffect(() => {
    if (!stickRef.current) return;
    scrollToBottom(active ? 'auto' : 'smooth');
  }, [messages.length, smoothedContent, active, scrollToBottom]);

  return (
    <div className="relative mx-auto flex w-full max-w-[860px] flex-col gap-6 px-5 pb-10 pt-6">
      {messages.map((message, idx) => {
        if (message.role === 'user') {
          const hasAttachments = !!message.attachments?.length;
          return (
            <div
              key={message.id}
              className="flex justify-end"
              style={{
                animation: 'marineFadeSlideUp 260ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <div
                className="max-w-[85%] rounded-[18px] border px-4 py-2 text-[13px] leading-[20px]"
                style={{
                  borderColor: 'var(--marine-teal-border)',
                  backgroundColor: 'var(--marine-teal-tint)',
                  color: 'var(--marine-teal-dark)',
                }}
              >
                {message.content.trim() ? (
                  message.content
                ) : hasAttachments ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attached document
                  </span>
                ) : null}
                {hasAttachments && (
                  <AttachmentPills attachments={message.attachments!} />
                )}
              </div>
            </div>
          );
        }

        return (
          <AssistantMessage
            key={message.id}
            message={message}
            isLast={idx === messages.length - 1}
            debugMode={debugMode}
            activeCitation={activeCitation}
            onCitationClick={onCitationClick}
            getCitationPreview={getCitationPreview}
          />
        );
      })}

      {(streamingContent || isLoading) && (
        <div
          className="flex flex-col items-start"
          style={{
            animation: 'marineFadeSlideUp 260ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {debugMode && (
            <div className="w-full max-w-none">
              <MarineDebugPanel
                agentName={streamingAgentName}
                thoughts={streamingThoughts}
                parts={streamingParts}
                isStreaming
              />
            </div>
          )}
          <MarineActivityStatus
            thoughts={streamingThoughts}
            parts={streamingParts}
            active={active}
            hasContent={hasStreamText}
            startedAt={startedAtRef.current}
          />
          {hasStreamText && (
            <div
              className="prose max-w-none text-[15px] leading-[26px]"
              style={{ color: 'var(--marine-text)' }}
            >
              <StreamedMarkdown content={smoothedContent} components={streamingComponents} />
              {active && (
                <span
                  className="ml-1 inline-block h-4 w-[3px] animate-pulse rounded-sm align-middle"
                  style={{ backgroundColor: 'var(--marine-teal)' }}
                />
              )}
            </div>
          )}
          {streamingCitations && streamingCitations.length > 0 ? (
            <SourcePills
              citations={dedupeCitations(streamingCitations)}
              activeCitation={activeCitation}
              onCitationClick={onCitationClick}
            />
          ) : hasStreamText ? (
            <SourcePlaceholder />
          ) : null}
        </div>
      )}

      <div ref={endRef} />

      {showJump && (
        <div className="pointer-events-none sticky bottom-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              stickRef.current = true;
              setShowJump(false);
              scrollToBottom('smooth');
            }}
            className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium shadow-md transition-all hover:brightness-95"
            style={{
              backgroundColor: 'var(--marine-surface)',
              borderColor: 'var(--marine-border-strong)',
              color: 'var(--marine-teal-dark)',
            }}
            aria-label="Jump to latest"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Jump to latest
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes marineShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .marine-shimmer {
          background: linear-gradient(
            90deg,
            var(--marine-text-muted) 0%,
            var(--marine-teal) 50%,
            var(--marine-text-muted) 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: marineShimmer 2.2s linear infinite;
        }
        @keyframes marineFadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

/** De-duplicates citations by fileId+page. */
function dedupeCitations(citations: MessageCitation[]): MessageCitation[] {
  const seen = new Set<string>();
  const out: MessageCitation[] = [];
  for (const c of citations) {
    const key = `${c.fileId}:${c.page ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
