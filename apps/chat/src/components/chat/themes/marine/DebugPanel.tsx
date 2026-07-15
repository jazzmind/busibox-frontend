'use client';

/**
 * Marine debug panel — rendered above/around assistant messages when debug
 * mode is on. Composes the shared StepTimeline + ThinkingStream and adds a
 * small Marine-styled agent badge + collapsible tool-call cards + a
 * collapsible routing_decision payload viewer.
 */

import { useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Wrench,
} from 'lucide-react';
import { StepTimeline } from '@jazzmind/busibox-app/components/chat/StepTimeline';
import { ThinkingStream } from '@jazzmind/busibox-app/components/chat/ThinkingStream';
import type { ThoughtEvent, MessagePart } from '@jazzmind/busibox-app/types/chat';

interface DebugPanelProps {
  agentName?: string;
  model?: string;
  thoughts?: ThoughtEvent[];
  parts?: MessagePart[];
  routingDecision?: any;
  isStreaming?: boolean;
}

export function MarineDebugPanel({
  agentName,
  model,
  thoughts = [],
  parts = [],
  routingDecision,
  isStreaming = false,
}: DebugPanelProps) {
  const toolParts = parts.filter(
    (p): p is Extract<MessagePart, { type: 'tool_call' }> => p.type === 'tool_call',
  );

  const hasThinking = thoughts.some(
    (t) => t.type === 'thought' && t.data?.phase === 'model_reasoning',
  );
  const hasSteps = thoughts.length > 0 || parts.length > 0;
  const hasRouting = routingDecision && Object.keys(routingDecision).length > 0;

  if (!agentName && !model && !hasSteps && !hasThinking && !toolParts.length && !hasRouting) {
    return null;
  }

  return (
    <div
      className="mb-3 rounded-lg border p-3"
      style={{
        borderColor: 'var(--marine-border-strong)',
        backgroundColor: 'var(--marine-surface-alt)',
      }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: 'var(--marine-teal-light)',
            color: 'var(--marine-teal-dark)',
            letterSpacing: '0.08em',
            fontSize: '10px',
          }}
        >
          <Bot className="h-3 w-3" />
          Debug
        </span>
        {agentName && (
          <span className="text-[11px]" style={{ color: 'var(--marine-text-body)' }}>
            Agent: <span className="font-semibold">{agentName}</span>
          </span>
        )}
        {model && (
          <span className="text-[11px]" style={{ color: 'var(--marine-text-body)' }}>
            Model: <span className="font-mono font-semibold">{model}</span>
          </span>
        )}
        {isStreaming && (
          <span
            className="inline-flex items-center gap-1 text-[10px]"
            style={{ color: 'var(--marine-teal)' }}
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            streaming
          </span>
        )}
      </div>

      {hasSteps && (
        <div className="mb-2">
          <StepTimeline thoughts={thoughts} parts={parts} isActive={isStreaming} />
        </div>
      )}

      {hasThinking && (
        <div className="mb-2">
          <ThinkingStream
            thoughts={thoughts}
            isActive={isStreaming}
            defaultExpanded={false}
          />
        </div>
      )}

      {toolParts.length > 0 && (
        <div className="mb-2 flex flex-col gap-1.5">
          {toolParts.map((tp) => (
            <ToolCallDebugCard key={tp.id} part={tp} />
          ))}
        </div>
      )}

      {hasRouting && <RoutingDecisionCollapsible routing={routingDecision} />}
    </div>
  );
}

function ToolCallDebugCard({
  part,
}: {
  part: Extract<MessagePart, { type: 'tool_call' }>;
}) {
  const [open, setOpen] = useState(false);

  const statusIcon = (() => {
    switch (part.status) {
      case 'completed':
        return <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--marine-success)' }} />;
      case 'error':
        return <XCircle className="h-3.5 w-3.5" style={{ color: 'var(--marine-error)' }} />;
      case 'running':
        return (
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--marine-teal)' }} />
        );
      default:
        return <Wrench className="h-3.5 w-3.5" style={{ color: 'var(--marine-text-muted)' }} />;
    }
  })();

  const duration =
    part.startedAt && part.completedAt
      ? `${Math.round(
          (part.completedAt.getTime() - part.startedAt.getTime()) / 100,
        ) / 10}s`
      : null;

  return (
    <details
      className="overflow-hidden rounded-md border text-xs"
      style={{ borderColor: 'var(--marine-border)', backgroundColor: 'var(--marine-surface)' }}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary
        className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--marine-teal-tint)]"
        style={{ listStyle: 'none' }}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" style={{ color: 'var(--marine-text-muted)' }} />
        ) : (
          <ChevronRight className="h-3 w-3" style={{ color: 'var(--marine-text-muted)' }} />
        )}
        {statusIcon}
        <span className="font-medium" style={{ color: 'var(--marine-text)' }}>
          {part.displayName || part.name}
        </span>
        {duration && (
          <span
            className="ml-auto font-mono tabular-nums"
            style={{ color: 'var(--marine-text-subtle)' }}
          >
            {duration}
          </span>
        )}
      </summary>
      <div
        className="border-t px-3 py-2 text-[11px]"
        style={{ borderColor: 'var(--marine-border)' }}
      >
        {part.output && (
          <div className="mb-1.5">
            <div
              className="mb-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--marine-text-subtle)', letterSpacing: '0.08em' }}
            >
              Output
            </div>
            <pre
              className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded p-1.5 font-mono text-[10px]"
              style={{ backgroundColor: 'var(--marine-bg)', color: 'var(--marine-text-body)' }}
            >
              {part.output.slice(0, 2000)}
              {part.output.length > 2000 ? `\n… (${part.output.length - 2000} more chars)` : ''}
            </pre>
          </div>
        )}
        {part.error && (
          <div>
            <div
              className="mb-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--marine-error)', letterSpacing: '0.08em' }}
            >
              Error
            </div>
            <pre
              className="whitespace-pre-wrap break-words rounded p-1.5 font-mono text-[10px]"
              style={{ backgroundColor: 'var(--marine-error-tint)', color: 'var(--marine-error-text)' }}
            >
              {part.error}
            </pre>
          </div>
        )}
        {!part.output && !part.error && (
          <span className="italic" style={{ color: 'var(--marine-text-subtle)' }}>
            (no output yet)
          </span>
        )}
      </div>
    </details>
  );
}

function RoutingDecisionCollapsible({ routing }: { routing: any }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="overflow-hidden rounded-md border text-xs"
      style={{ borderColor: 'var(--marine-border)', backgroundColor: 'var(--marine-surface)' }}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary
        className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--marine-teal-tint)]"
        style={{ listStyle: 'none' }}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" style={{ color: 'var(--marine-text-muted)' }} />
        ) : (
          <ChevronRight className="h-3 w-3" style={{ color: 'var(--marine-text-muted)' }} />
        )}
        <span className="font-medium" style={{ color: 'var(--marine-text)' }}>
          Routing decision
        </span>
        <span className="ml-auto text-[10px]" style={{ color: 'var(--marine-text-subtle)' }}>
          {routing.primaryModel || routing.model || 'json'}
        </span>
      </summary>
      <div
        className="border-t px-3 py-2 text-[10px]"
        style={{ borderColor: 'var(--marine-border)' }}
      >
        <pre
          className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded p-2 font-mono"
          style={{ backgroundColor: 'var(--marine-bg)', color: 'var(--marine-text-body)' }}
        >
          {JSON.stringify(routing, null, 2)}
        </pre>
      </div>
    </details>
  );
}
