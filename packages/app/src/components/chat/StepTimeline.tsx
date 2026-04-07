'use client';

import { useState } from 'react';
import {
  Brain,
  ListChecks,
  Search,
  Wrench,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Zap,
} from 'lucide-react';
import type { ThoughtEvent, MessagePart } from '../../types/chat';

interface StepTimelineProps {
  thoughts: ThoughtEvent[];
  parts: MessagePart[];
  isActive: boolean;
  defaultExpanded?: boolean;
}

type PhaseType = 'dispatch' | 'plan' | 'tool' | 'thinking' | 'response';

interface Phase {
  type: PhaseType;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  details?: string;
  children?: PhaseChild[];
}

interface PhaseChild {
  label: string;
  status: 'running' | 'completed' | 'error';
  duration?: string;
  output?: string;
}

function derivePhases(thoughts: ThoughtEvent[], parts: MessagePart[], isActive: boolean): Phase[] {
  const phases: Phase[] = [];

  const intentThought = thoughts.find(t => t.data?.phase === 'intent_routing');
  const planThought = thoughts.find(t => t.type === 'plan');
  const toolParts = parts.filter((p): p is Extract<MessagePart, { type: 'tool_call' }> => p.type === 'tool_call');
  const hasThinking = thoughts.some(t => t.data?.phase === 'model_reasoning');
  const hasContent = thoughts.some(t => t.type === 'content') || thoughts.some(t => t.data?.phase === 'deep_response');

  // 1. Dispatch phase
  if (intentThought) {
    const actionType = String(intentThought.data?.action_type || 'routing');
    phases.push({
      type: 'dispatch',
      label: `Dispatch: ${actionType}`,
      status: 'completed',
      details: intentThought.message,
    });
  }

  // 2. Plan phase
  const modelUpgrade = thoughts.find(t => t.data?.phase === 'model_upgrade');
  if (planThought || modelUpgrade) {
    const planLabel = modelUpgrade
      ? `Plan — using ${modelUpgrade.data?.model || 'advanced'} model`
      : 'Execution Plan';
    phases.push({
      type: 'plan',
      label: planLabel,
      status: 'completed',
      details: planThought?.message,
    });
  }

  // 3. Tool execution phase — derive from parts (streaming) or thoughts (stored)
  if (toolParts.length > 0) {
    const allDone = toolParts.every(p => p.status === 'completed' || p.status === 'error');
    const anyError = toolParts.some(p => p.status === 'error');
    const children: PhaseChild[] = toolParts.map(p => {
      let duration: string | undefined;
      if (p.startedAt && p.completedAt) {
        const ms = p.completedAt.getTime() - p.startedAt.getTime();
        duration = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
      }
      return {
        label: p.displayName || p.name,
        status: p.status === 'error' ? 'error' : p.status === 'completed' ? 'completed' : 'running',
        duration,
        output: p.output,
      };
    });
    phases.push({
      type: 'tool',
      label: `Tools (${toolParts.length})`,
      status: allDone ? (anyError ? 'error' : 'completed') : 'active',
      children,
    });
  } else {
    // Fallback: derive tool info from thought events (loaded from DB)
    const toolResults = thoughts.filter(t => t.type === 'tool_result');
    const toolStarts = thoughts.filter(t => t.type === 'tool_start');
    const toolCount = Math.max(toolResults.length, toolStarts.length);

    if (toolCount > 0) {
      const resultSources = new Set(toolResults.map(t => t.source));
      const children: PhaseChild[] = [];

      for (const tr of toolResults) {
        children.push({
          label: tr.source || 'tool',
          status: 'completed',
          output: tr.message,
        });
      }
      for (const ts of toolStarts) {
        if (!resultSources.has(ts.source)) {
          children.push({
            label: ts.source || 'tool',
            status: isActive ? 'running' : 'error',
          });
        }
      }

      const anyError = children.some(c => c.status === 'error');
      phases.push({
        type: 'tool',
        label: `Tools (${children.length})`,
        status: anyError ? 'error' : 'completed',
        children,
      });
    }
  }

  // 4. Thinking phase
  if (hasThinking) {
    const stillThinking = isActive && !hasContent;
    phases.push({
      type: 'thinking',
      label: 'Reasoning',
      status: stillThinking ? 'active' : 'completed',
    });
  }

  // 5. Response phase (only during streaming or when there are other phases)
  if (isActive && phases.length > 0) {
    phases.push({
      type: 'response',
      label: 'Response',
      status: isActive ? 'active' : 'completed',
    });
  }

  return phases;
}

const phaseIcons: Record<PhaseType, React.ReactNode> = {
  dispatch: <Zap className="w-3.5 h-3.5" />,
  plan: <ListChecks className="w-3.5 h-3.5" />,
  tool: <Wrench className="w-3.5 h-3.5" />,
  thinking: <Brain className="w-3.5 h-3.5" />,
  response: <ArrowRight className="w-3.5 h-3.5" />,
};

const statusColors = {
  pending: 'text-gray-400 dark:text-gray-600',
  active: 'text-blue-500 dark:text-blue-400',
  completed: 'text-green-500 dark:text-green-400',
  error: 'text-red-500 dark:text-red-400',
};

function getToolIcon(label: string) {
  const lc = label.toLowerCase();
  if (lc.includes('search') || lc.includes('web')) return <Search className="w-2.5 h-2.5" />;
  return <Wrench className="w-2.5 h-2.5" />;
}

export function StepTimeline({ thoughts, parts, isActive, defaultExpanded }: StepTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);

  const phases = derivePhases(thoughts, parts, isActive);

  if (phases.length === 0 && !isActive) return null;

  const completedCount = phases.filter(p => p.status === 'completed').length;
  const activePhase = phases.find(p => p.status === 'active');

  // Build summary text similar to ThinkingToggle
  const toolPhase = phases.find(p => p.type === 'tool');
  const toolCount = toolPhase?.children?.length || 0;
  const summaryParts: string[] = [];
  if (toolCount > 0) summaryParts.push(`${toolCount} tool${toolCount !== 1 ? 's' : ''}`);
  if (phases.some(p => p.type === 'plan')) summaryParts.push('plan');
  const summaryText = summaryParts.length > 0
    ? summaryParts.join(', ')
    : `${completedCount} step${completedCount !== 1 ? 's' : ''}`;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center gap-1.5 w-full text-left text-xs cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        {/* Mini progress dots */}
        <div className="flex items-center gap-0.5">
          {phases.map((phase, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                phase.status === 'completed' ? 'bg-green-500' :
                phase.status === 'active' ? 'bg-blue-500 animate-pulse' :
                phase.status === 'error' ? 'bg-red-500' :
                'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
        <span className="font-medium">
          {isActive
            ? activePhase?.label || 'Working...'
            : `Used ${summaryText}`}
        </span>
        {isActive && <Loader2 className="w-3 h-3 animate-spin" />}
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 ml-auto" />
        ) : (
          <ChevronRight className="w-3 h-3 ml-auto" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-1.5 ml-1 border-l-2 border-gray-200 dark:border-gray-700 space-y-0">
          {phases.map((phase, i) => (
            <div key={i} className="relative pl-4 py-1">
              {/* Connector dot */}
              <div className={`absolute left-[-5px] top-[10px] w-2 h-2 rounded-full border-2 border-white dark:border-gray-900 ${
                phase.status === 'completed' ? 'bg-green-500' :
                phase.status === 'active' ? 'bg-blue-500' :
                phase.status === 'error' ? 'bg-red-500' :
                'bg-gray-300 dark:bg-gray-600'
              }`} />

              <div className="flex items-center gap-1.5 text-xs">
                <span className={statusColors[phase.status]}>
                  {phase.status === 'active' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : phase.status === 'error' ? (
                    <AlertCircle className="w-3.5 h-3.5" />
                  ) : phase.status === 'completed' ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    phaseIcons[phase.type]
                  )}
                </span>
                <span className={`font-medium ${
                  phase.status === 'active' ? 'text-blue-700 dark:text-blue-300' :
                  phase.status === 'completed' ? 'text-gray-700 dark:text-gray-300' :
                  phase.status === 'error' ? 'text-red-700 dark:text-red-300' :
                  'text-gray-500 dark:text-gray-500'
                }`}>
                  {phase.label}
                </span>
              </div>

              {/* Plan details */}
              {phase.type === 'plan' && phase.details && (
                <div className="ml-5 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 italic">
                  {phase.details}
                </div>
              )}

              {/* Children (tools) */}
              {phase.children && phase.children.length > 0 && (
                <div className="ml-5 mt-0.5 space-y-0.5">
                  {phase.children.map((child, j) => (
                    <div key={j} className="flex items-center gap-1.5 text-[11px]">
                      {child.status === 'running' ? (
                        <Loader2 className="w-2.5 h-2.5 text-blue-500 animate-spin" />
                      ) : child.status === 'error' ? (
                        <AlertCircle className="w-2.5 h-2.5 text-red-500" />
                      ) : (
                        <span className="text-green-500">{getToolIcon(child.label)}</span>
                      )}
                      <span className="text-gray-600 dark:text-gray-400">{child.label}</span>
                      {child.output && (
                        <span className="text-gray-400 dark:text-gray-500 truncate max-w-[200px]">{child.output}</span>
                      )}
                      {child.duration && (
                        <span className="text-gray-400 dark:text-gray-500 tabular-nums ml-auto">{child.duration}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isActive && phases.length === 0 && (
            <div className="relative pl-4 py-1">
              <div className="absolute left-[-5px] top-[10px] w-2 h-2 rounded-full border-2 border-white dark:border-gray-900 bg-blue-500 animate-pulse" />
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                <span>Starting...</span>
              </div>
            </div>
          )}

          {thoughts.length > 0 && !isActive && (
            <RawTrace thoughts={thoughts} />
          )}

        </div>
      )}
    </div>
  );
}

function RawTrace({ thoughts }: { thoughts: ThoughtEvent[] }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative pl-4 pt-1.5 border-t border-gray-100 dark:border-gray-800 mt-1">
      <button
        type="button"
        onClick={() => setShow(prev => !prev)}
        className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
      >
        {show ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
        Raw trace
      </button>
      {show && (
        <pre className="mt-1 p-1.5 bg-gray-100 dark:bg-gray-900 rounded overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto text-[10px] text-gray-600 dark:text-gray-400 font-mono">
          {JSON.stringify(thoughts, null, 2)}
        </pre>
      )}
    </div>
  );
}
