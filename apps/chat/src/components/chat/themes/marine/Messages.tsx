'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
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
import type { CitationPreviewData } from './primitives/CitationPreview';
import { MarineDebugPanel } from './DebugPanel';
import { MarineAttachmentStatus } from './AttachmentStatus';

const INLINE_DOCUMENT_CITATION_RE = /\s*\[[^\]]+\]\(doc:[^)]+\)/g;
const STREAMING_ACTIVITY_LABELS = [
  'Reviewing',
  'Gathering',
  'Synthesizing',
  'Curating',
  'Connecting',
  'Composing',
];

function stripInlineDocumentCitations(content: string): string {
  return content.replace(INLINE_DOCUMENT_CITATION_RE, '').replace(/[ \t]+\n/g, '\n');
}

function MarkdownAnchor({
  href,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
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
}

export type CitationPreviewLookup = (
  fileId: string,
  page?: number,
) => CitationPreviewData | undefined;

function StreamingActivity() {
  const [labelIndex, setLabelIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLabelIndex((current) => {
        if (STREAMING_ACTIVITY_LABELS.length < 2) return current;
        const offset = 1 + Math.floor(Math.random() * (STREAMING_ACTIVITY_LABELS.length - 1));
        return (current + offset) % STREAMING_ACTIVITY_LABELS.length;
      });
    }, 1400);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-2 inline-flex items-center gap-2 text-xs font-medium"
      style={{ color: 'var(--marine-text-muted)' }}
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-35"
          style={{ backgroundColor: 'var(--marine-teal)' }}
        />
        <span
          className="relative inline-flex h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: 'var(--marine-teal)' }}
        />
      </span>
      <span key={labelIndex} className="marineStatusBlink">
        {STREAMING_ACTIVITY_LABELS[labelIndex]}…
      </span>
    </div>
  );
}

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
  /** Retained for consumers that prepare preview data; footer sources are canonical. */
  getCitationPreview?: CitationPreviewLookup;
  /** When true, render debug panels (step timeline, thoughts, tool cards, routing). */
  debugMode?: boolean;
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
        const label = c.filename || 'Source';
        return (
          <button
            key={c.fileId}
            type="button"
            onClick={() => onCitationClick(c.fileId, c.page)}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all hover:brightness-95 active:scale-[0.98]"
            style={{
              borderColor: isActive ? 'var(--marine-teal)' : 'var(--marine-border)',
              backgroundColor: isActive ? 'var(--marine-teal-light)' : 'var(--marine-surface)',
              color: isActive ? 'var(--marine-teal-dark)' : 'var(--marine-text-body)',
            }}
          >
            <span
              className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
              style={{ backgroundColor: 'var(--marine-teal-light)', color: 'var(--marine-teal-dark)' }}
            >
              {idx + 1}
            </span>
            <FileText className="h-3.5 w-3.5" style={{ color: 'var(--marine-teal)' }} />
            {label}
          </button>
        );
      })}
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
  debugMode = false,
}: MarineMessagesProps) {
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

        const cleanContent = stripInlineDocumentCitations(message.content);
        const isLast = idx === messages.length - 1;
        return (
          <div
            key={message.id}
            className="flex flex-col items-start"
            style={{
              animation: isLast
                ? 'marineFadeSlideUp 260ms cubic-bezier(0.4,0,0.2,1)'
                : undefined,
            }}
          >
            {debugMode && (
              <div className="w-full max-w-none">
                <MarineDebugPanel
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
              style={{ color: 'var(--marine-text)' }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ a: MarkdownAnchor }}
              >
                {cleanContent}
              </ReactMarkdown>
            </div>

            {message.citations && message.citations.length > 0 ? (
              <SourcePills
                citations={dedupeCitations(message.citations)}
                activeCitation={activeCitation}
                onCitationClick={onCitationClick}
              />
            ) : null}

            <MessageActions content={cleanContent} />
          </div>
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
          <div
            className="prose max-w-none text-[15px] leading-[26px]"
            style={{ color: 'var(--marine-text)' }}
          >
            {streamingContent ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ a: MarkdownAnchor }}
              >
                {stripInlineDocumentCitations(streamingContent)}
              </ReactMarkdown>
            ) : null}
          </div>
          <StreamingActivity />
          {streamingCitations && streamingCitations.length > 0 ? (
            <SourcePills
              citations={dedupeCitations(streamingCitations)}
              activeCitation={activeCitation}
              onCitationClick={onCitationClick}
            />
          ) : null}
        </div>
      )}

      <div ref={endRef} />

      <style jsx global>{`
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
        @keyframes marineStatusBlink {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .marineStatusBlink {
          animation: marineStatusBlink 1.1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/** De-duplicates citations by document; the retained page is still used when opening it. */
function dedupeCitations(citations: MessageCitation[]): MessageCitation[] {
  const seen = new Set<string>();
  const out: MessageCitation[] = [];
  for (const c of citations) {
    const key = c.fileId;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
