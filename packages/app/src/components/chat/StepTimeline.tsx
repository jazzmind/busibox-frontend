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

  // 3. Tool execution phase
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
      };
    });
    phases.push({
      type: 'tool',
      label: `Tools (${toolParts.length})`,
      status: allDone ? (anyError ? 'error' : 'completed') : 'active',
      children,
    });
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

  // 5. Response phase
  if (hasContent || (!isActive && phases.length > 0)) {
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

export function StepTimeline({ thoughts, parts, isActive }: StepTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const phases = derivePhases(thoughts, parts, isActive);

  if (phases.length === 0 && !isActive) return null;

  const completedCount = phases.filter(p => p.status === 'completed').length;
  const activePhase = phases.find(p => p.status === 'active');

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
            : `${completedCount} step${completedCount !== 1 ? 's' : ''}`}
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
                        <CheckCircle className="w-2.5 h-2.5 text-green-500" />
                      )}
                      <span className="text-gray-600 dark:text-gray-400">{child.label}</span>
                      {child.duration && (
                        <span className="text-gray-400 dark:text-gray-500 tabular-nums ml-auto">{child.duration}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
