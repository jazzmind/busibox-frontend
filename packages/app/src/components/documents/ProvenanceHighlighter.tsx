'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Provenance {
  text?: string;
  charOffset?: number;
  charLength?: number;
}

interface ProvenanceSelection {
  label?: string;
  candidates?: Provenance[];
}

interface ProvenanceHighlighterProps {
  markdown: string;
  selected?: Provenance | ProvenanceSelection | null;
}

export function ProvenanceHighlighter({ markdown, selected }: ProvenanceHighlighterProps) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const highlightRef = useRef<HTMLSpanElement | null>(null);

  const candidates = useMemo(() => {
    if (!selected) return [];
    if (Array.isArray((selected as ProvenanceSelection).candidates)) {
      return ((selected as ProvenanceSelection).candidates || []).filter(
        (c) => typeof c?.charOffset === 'number' && typeof c?.charLength === 'number'
      );
    }
    if (
      typeof (selected as Provenance).charOffset === 'number' &&
      typeof (selected as Provenance).charLength === 'number'
    ) {
      return [selected as Provenance];
    }
    return [];
  }, [selected]);

  useEffect(() => {
    setCandidateIndex(0);
  }, [selected]);

  const active = candidates[candidateIndex] || candidates[0];
  const content = useMemo(() => {
    if (!active || typeof active.charOffset !== 'number' || typeof active.charLength !== 'number') {
      return { before: markdown, match: '', after: '' };
    }
    const start = Math.max(0, active.charOffset);
    const end = Math.min(markdown.length, start + Math.max(0, active.charLength));
    return {
      before: markdown.slice(0, start),
      match: markdown.slice(start, end),
      after: markdown.slice(end),
    };
  }, [markdown, active]);

  useEffect(() => {
    if (!content.match) return;
    if (!highlightRef.current) return;
    highlightRef.current.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [content.match, active?.charOffset, active?.charLength]);

  return (
    <div className="h-full overflow-auto rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <article className="prose prose-sm max-w-none text-gray-900 dark:prose-invert">
        {content.before ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.before}</ReactMarkdown>
        ) : null}
        {content.match ? (
          <mark className="block rounded bg-yellow-300/80 px-1 py-0.5 text-gray-900 shadow-[0_0_0_2px_rgba(250,204,21,0.45)] dark:bg-yellow-300/60">
            <span ref={highlightRef} className="whitespace-pre-wrap">
              {content.match}
            </span>
          </mark>
        ) : null}
        {content.after ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.after}</ReactMarkdown>
        ) : null}
      </article>
      {candidates.length > 1 ? (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-200">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setCandidateIndex((idx) => (idx - 1 + candidates.length) % candidates.length)}
              className="inline-flex items-center rounded border border-amber-300 px-1 py-0.5 hover:bg-amber-100 dark:border-amber-700/50 dark:hover:bg-amber-900/50"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span>
              Multiple provenance matches: {candidateIndex + 1} / {candidates.length}
            </span>
            <button
              onClick={() => setCandidateIndex((idx) => (idx + 1) % candidates.length)}
              className="inline-flex items-center rounded border border-amber-300 px-1 py-0.5 hover:bg-amber-100 dark:border-amber-700/50 dark:hover:bg-amber-900/50"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : null}
      {(selected as Provenance)?.text ? (
        <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900 dark:border-blue-700/40 dark:bg-blue-900/30 dark:text-blue-200">
          <div className="font-semibold">Selected provenance text</div>
          <div className="mt-1 whitespace-pre-wrap">{(selected as Provenance).text}</div>
        </div>
      ) : null}
    </div>
  );
}
