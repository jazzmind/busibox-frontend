'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText,
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
import { Tooltip } from './Tooltip';
import { CitationPreview, type CitationPreviewData } from './CitationPreview';
import { CashmanDebugPanel } from './CashmanDebugPanel';

const DOC_LINK_RE = /^doc:([^:]+)(?::(\d+))?$/;

const preserveDocUrl = (url: string): string =>
  url.startsWith('doc:') ? url : defaultUrlTransform(url);

export type CitationPreviewLookup = (
  fileId: string,
  page?: number,
) => CitationPreviewData | undefined;

interface CashmanMessagesProps {
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
        style={{ backgroundColor: 'var(--cashman-teal-light)', color: 'var(--cashman-teal-dark)' }}
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
        const preview = getCitationPreview?.(fileId, page);
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
        style={{ color: 'var(--cashman-teal)' }}
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
      style={{ borderColor: 'var(--cashman-border)' }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: 'var(--cashman-text-subtle)', letterSpacing: '0.08em' }}
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
              borderColor: isActive ? 'var(--cashman-teal)' : 'var(--cashman-border)',
              backgroundColor: isActive ? 'var(--cashman-teal-light)' : 'var(--cashman-surface)',
              color: isActive ? 'var(--cashman-teal-dark)' : 'var(--cashman-text-body)',
            }}
          >
            <FileText className="h-3.5 w-3.5" style={{ color: 'var(--cashman-teal)' }} />
            {label}
          </button>
        );
      })}
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
    a.download = 'cashman-response.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const buttonClass =
    'flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--cashman-teal-tint)]';

  return (
    <div className="mt-2 flex items-center gap-1">
      <Tooltip label="Helpful">
        <button
          type="button"
          onClick={() => setVote(vote === 'up' ? null : 'up')}
          className={buttonClass}
          style={{ color: vote === 'up' ? 'var(--cashman-teal-dark)' : 'var(--cashman-text-subtle)' }}
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
          style={{ color: vote === 'down' ? 'var(--cashman-error)' : 'var(--cashman-text-subtle)' }}
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
          style={{ color: copied ? 'var(--cashman-teal-dark)' : 'var(--cashman-text-subtle)' }}
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
          style={{ color: 'var(--cashman-text-subtle)' }}
          aria-label="Download"
        >
          <Download className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );
}

export function CashmanMessages({
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
}: CashmanMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = endRef.current;
    if (!el) return;
    const scroller = el.closest<HTMLElement>('[data-chat-scroll="1"]');
    if (scroller) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    }
  }, [messages.length, streamingContent]);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-5 pb-10 pt-6">
      {messages.map((message, idx) => {
        if (message.role === 'user') {
          return (
            <div
              key={message.id}
              className="flex justify-end"
              style={{
                animation: 'cashmanFadeSlideUp 260ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <div
                className="rounded-full border px-4 py-2 text-[13px] leading-[20px]"
                style={{
                  borderColor: 'var(--cashman-teal-border)',
                  backgroundColor: 'var(--cashman-teal-tint)',
                  color: 'var(--cashman-teal-dark)',
                  maxWidth: '85%',
                }}
              >
                {message.content}
              </div>
            </div>
          );
        }

        const renderer = makeCitationRenderer(
          message.citations,
          onCitationClick,
          getCitationPreview,
        );
        const isLast = idx === messages.length - 1;
        return (
          <div
            key={message.id}
            className="flex flex-col items-start"
            style={{
              animation: isLast
                ? 'cashmanFadeSlideUp 260ms cubic-bezier(0.4,0,0.2,1)'
                : undefined,
            }}
          >
            {debugMode && (
              <div className="w-full max-w-none">
                <CashmanDebugPanel
                  agentName={(message as any).agentName}
                  model={(message as any).model}
                  thoughts={(message as any).thoughts}
                  parts={(message as any).parts}
                  routingDecision={(message as any).routingDecision}
                />
              </div>
            )}
            <div
              className="prose max-w-none text-[15px] leading-[26px]"
              style={{ color: 'var(--cashman-text)' }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={preserveDocUrl}
                components={{ a: renderer }}
              >
                {message.content}
              </ReactMarkdown>
            </div>

            {message.citations && message.citations.length > 0 && (
              <SourcePills
                citations={dedupeCitations(message.citations)}
                activeCitation={activeCitation}
                onCitationClick={onCitationClick}
              />
            )}

            <MessageActions content={message.content} />
          </div>
        );
      })}

      {(streamingContent || isLoading) && (
        <div
          className="flex flex-col items-start"
          style={{
            animation: 'cashmanFadeSlideUp 260ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {debugMode && (
            <div className="w-full max-w-none">
              <CashmanDebugPanel
                agentName={streamingAgentName}
                thoughts={streamingThoughts}
                parts={streamingParts}
                isStreaming
              />
            </div>
          )}
          <div
            className="prose max-w-none text-[15px] leading-[26px]"
            style={{ color: 'var(--cashman-text)' }}
          >
            {streamingContent ? (
              <>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  urlTransform={preserveDocUrl}
                  components={{
                    a: makeCitationRenderer(
                      streamingCitations,
                      onCitationClick,
                      getCitationPreview,
                    ),
                  }}
                >
                  {streamingContent}
                </ReactMarkdown>
                <span
                  className="ml-1 inline-block h-4 w-[3px] animate-pulse rounded-sm align-middle"
                  style={{ backgroundColor: 'var(--cashman-teal)' }}
                />
              </>
            ) : (
              <div className="flex items-center gap-2" style={{ color: 'var(--cashman-text-muted)' }}>
                <span className="flex gap-1">
                  <span
                    className="h-2 w-2 animate-bounce rounded-full"
                    style={{ backgroundColor: 'var(--cashman-teal)', animationDelay: '0ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full"
                    style={{ backgroundColor: 'var(--cashman-teal)', animationDelay: '150ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full"
                    style={{ backgroundColor: 'var(--cashman-teal)', animationDelay: '300ms' }}
                  />
                </span>
                <span className="text-sm">Thinking…</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={endRef} />

      <style jsx global>{`
        @keyframes cashmanFadeSlideUp {
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
