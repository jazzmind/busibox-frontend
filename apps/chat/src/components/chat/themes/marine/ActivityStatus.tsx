'use client';

/**
 * ActivityStatus — the "what is it doing right now" line.
 *
 * While the assistant is working and no answer text has arrived, this shows
 * the latest progress message or running tool plus an elapsed-time counter
 * (the ChatGPT / Claude "Searching the web…" line). Once text starts
 * streaming, or the turn completes, it collapses to a one-line summary of the
 * steps taken that can be expanded to see each step.
 *
 * Data comes straight from the stream: `progress`/`plan` thoughts and
 * `tool_call` parts. Nothing here requires debug mode.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileSearch,
  Globe,
  Loader2,
  Database,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { MessagePart, ThoughtEvent } from '@jazzmind/busibox-app/types/chat';

type ToolPart = Extract<MessagePart, { type: 'tool_call' }>;

const TOOL_LABELS: Record<string, { running: string; done: string; Icon: typeof Globe }> = {
  document_search: { running: 'Searching documents', done: 'Searched documents', Icon: FileSearch },
  web_search: { running: 'Searching the web', done: 'Searched the web', Icon: Globe },
  deep_research: { running: 'Running deep research', done: 'Deep research', Icon: Sparkles },
  query_data: { running: 'Querying data', done: 'Queried data', Icon: Database },
};

function labelFor(part: ToolPart, running: boolean): string {
  const key = part.name.toLowerCase();
  const known = TOOL_LABELS[key];
  if (known) return running ? known.running : known.done;
  const display = part.displayName || part.name;
  return running ? `Running ${display}` : display;
}

function iconFor(part: ToolPart) {
  return TOOL_LABELS[part.name.toLowerCase()]?.Icon ?? Wrench;
}

function isProgressThought(t: ThoughtEvent): boolean {
  if (t.type !== 'progress' && t.type !== 'plan') return false;
  const data = (t.data ?? {}) as Record<string, unknown>;
  const nested = (data.data ?? {}) as Record<string, unknown>;
  const phase = (data.phase ?? nested.phase) as string | undefined;
  return phase !== 'model_reasoning';
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

interface ActivityStatusProps {
  thoughts?: ThoughtEvent[];
  parts?: MessagePart[];
  /** True while the turn is in flight. */
  active: boolean;
  /** True once answer text has started arriving. */
  hasContent: boolean;
  /** When the turn started; drives the elapsed counter. */
  startedAt?: number;
}

export function MarineActivityStatus({
  thoughts = [],
  parts = [],
  active,
  hasContent,
  startedAt,
}: ActivityStatusProps) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || hasContent) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, hasContent]);

  const tools = useMemo(
    () => parts.filter((p): p is ToolPart => p.type === 'tool_call'),
    [parts],
  );
  const progress = useMemo(() => thoughts.filter(isProgressThought), [thoughts]);
  const running = tools.filter((t) => t.status === 'running' || t.status === 'pending');
  const latestProgress = progress.length ? progress[progress.length - 1] : undefined;

  const steps = useMemo(() => {
    // One entry per tool name; a tool still running anywhere shows as running.
    const byName = new Map<string, { part: ToolPart; running: boolean }>();
    for (const t of tools) {
      const isRunning = t.status === 'running' || t.status === 'pending';
      const key = t.name.toLowerCase();
      const prev = byName.get(key);
      byName.set(key, { part: t, running: (prev?.running ?? false) || isRunning });
    }
    return Array.from(byName.values()).map(({ part, running }) => labelFor(part, running));
  }, [tools]);

  // Nothing happened worth showing (plain conversational reply).
  if (tools.length === 0 && progress.length === 0) {
    if (active && !hasContent) {
      return (
        <StatusLine
          text="Thinking"
          elapsed={startedAt ? formatElapsed(now - startedAt) : undefined}
          spinning
        />
      );
    }
    return null;
  }

  // Waiting phase: one live line.
  if (active && !hasContent) {
    const text = running.length
      ? labelFor(running[running.length - 1], true)
      : latestProgress?.message || 'Working on it';
    const extra =
      latestProgress && running.length && latestProgress.message !== text
        ? latestProgress.message
        : undefined;
    return (
      <div className="flex flex-col gap-1">
        <StatusLine
          text={text}
          elapsed={startedAt ? formatElapsed(now - startedAt) : undefined}
          spinning
        />
        {extra && (
          <span className="pl-6 text-xs" style={{ color: 'var(--marine-text-subtle)' }}>
            {extra}
          </span>
        )}
      </div>
    );
  }

  // Answer phase / done: collapsible summary.
  if (steps.length === 0) return null;
  const summary = steps.length <= 2 ? steps.join(' · ') : `${steps[0]} · ${steps[1]} · +${steps.length - 2}`;

  return (
    <div className="mb-2 w-full">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-[var(--marine-teal-tint)]"
        style={{ color: 'var(--marine-text-muted)' }}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {active && running.length > 0 ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--marine-teal)' }} />
        ) : null}
        <span>{summary}</span>
      </button>
      {expanded && (
        <ul
          className="mt-1 flex flex-col gap-1 border-l pl-3 text-xs"
          style={{ borderColor: 'var(--marine-border)', color: 'var(--marine-text-body)' }}
        >
          {tools.map((t) => {
            const Icon = iconFor(t);
            const isRunning = t.status === 'running' || t.status === 'pending';
            return (
              <li key={t.id} className="flex items-center gap-2">
                {t.status === 'error' ? (
                  <XCircle className="h-3.5 w-3.5" style={{ color: 'var(--marine-error)' }} />
                ) : isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--marine-teal)' }} />
                ) : (
                  <Check className="h-3.5 w-3.5" style={{ color: 'var(--marine-success)' }} />
                )}
                <Icon className="h-3.5 w-3.5" style={{ color: 'var(--marine-text-subtle)' }} />
                <span>{labelFor(t, isRunning)}</span>
                {t.error && (
                  <span style={{ color: 'var(--marine-error-text)' }}>— {t.error}</span>
                )}
              </li>
            );
          })}
          {progress.map((p, i) => (
            <li key={`p-${i}`} className="flex items-center gap-2" style={{ color: 'var(--marine-text-muted)' }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--marine-teal-muted)' }} />
              <span>{p.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusLine({ text, elapsed, spinning }: { text: string; elapsed?: string; spinning?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--marine-text-muted)' }}>
      {spinning ? (
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--marine-teal)' }} />
      ) : null}
      <span className="marine-shimmer">{text}…</span>
      {elapsed && (
        <span className="text-xs tabular-nums" style={{ color: 'var(--marine-text-subtle)' }}>
          {elapsed}
        </span>
      )}
    </div>
  );
}
