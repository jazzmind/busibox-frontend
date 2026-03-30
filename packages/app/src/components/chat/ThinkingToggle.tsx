'use client';
/**
 * ThinkingToggle Component
 * 
 * Progressive disclosure of agent reasoning with 3 layers:
 * 1. Summary bar (always visible) - counts of events by type
 * 2. Step-by-step (first expand) - each event with status icon
 * 3. Raw trace (second expand) - full event data as JSON
 */


import { useState } from 'react';
import { Brain, Bot, Search, FileText, ChevronDown, ChevronRight, Loader2, CheckCircle, AlertCircle, Wrench, Lightbulb, ListChecks, ArrowRight } from 'lucide-react';

/**
 * Represents a single thought/event in the execution process
 */
export interface ThoughtEvent {
  type: string;
  source?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp?: Date;
}

export interface ThinkingToggleProps {
  thoughts: ThoughtEvent[];
  isActive?: boolean;
  defaultOpen?: boolean;
}

function getSourceIcon(source: string) {
  if (source?.toLowerCase().includes('search')) return <Search className="w-3 h-3 inline mr-1" />;
  if (source?.toLowerCase().includes('scraper')) return <FileText className="w-3 h-3 inline mr-1" />;
  if (source?.toLowerCase().includes('dispatcher')) return <Brain className="w-3 h-3 inline mr-1" />;
  return <Bot className="w-3 h-3 inline mr-1" />;
}

function getEventIcon(type: string) {
  switch (type) {
    case 'thought': return <Brain className="w-3 h-3 flex-shrink-0" />;
    case 'plan': return <ListChecks className="w-3 h-3 flex-shrink-0" />;
    case 'progress': return <ArrowRight className="w-3 h-3 flex-shrink-0" />;
    case 'tool_start': return <Loader2 className="w-3 h-3 flex-shrink-0 animate-spin" />;
    case 'tool_result': return <CheckCircle className="w-3 h-3 flex-shrink-0" />;
    case 'error': return <AlertCircle className="w-3 h-3 flex-shrink-0" />;
    default: return <Lightbulb className="w-3 h-3 flex-shrink-0" />;
  }
}

function getEventColor(type: string): string {
  switch (type) {
    case 'thought': return 'text-purple-600 dark:text-purple-400';
    case 'plan': return 'text-indigo-600 dark:text-indigo-400';
    case 'progress': return 'text-cyan-600 dark:text-cyan-400';
    case 'interim': return 'text-amber-600 dark:text-amber-400';
    case 'tool_start': return 'text-blue-600 dark:text-blue-400';
    case 'tool_result': return 'text-green-600 dark:text-green-400';
    case 'error': return 'text-red-600 dark:text-red-400';
    default: return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * Builds a human-readable summary from thought events.
 */
function buildSummary(thoughts: ThoughtEvent[]): string {
  const counts: Record<string, number> = {};
  for (const t of thoughts) {
    const label = {
      thought: 'reasoning',
      plan: 'plan',
      progress: 'progress',
      tool_start: 'tool',
      tool_result: 'tool',
      error: 'error',
    }[t.type] || t.type;
    counts[label] = (counts[label] || 0) + 1;
  }
  // De-dup tool start+result into one count
  if (counts.tool) {
    counts.tool = Math.ceil(counts.tool / 2);
  }

  const parts: string[] = [];
  if (counts.tool) parts.push(`${counts.tool} tool${counts.tool > 1 ? 's' : ''}`);
  if (counts.reasoning) parts.push(`${counts.reasoning} step${counts.reasoning > 1 ? 's' : ''}`);
  if (counts.plan) parts.push('plan');
  if (counts.error) parts.push(`${counts.error} error${counts.error > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(', ') : `${thoughts.length} event${thoughts.length !== 1 ? 's' : ''}`;
}

/**
 * ThinkingToggle - Progressive disclosure with 3 layers:
 * 1. Summary bar (always visible)
 * 2. Step-by-step events (first expand)
 * 3. Raw JSON trace (second expand inside step-by-step)
 */
export function ThinkingToggle({ thoughts, isActive = false, defaultOpen = false }: ThinkingToggleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen || isActive);
  const [showRawTrace, setShowRawTrace] = useState(false);

  if (thoughts.length === 0 && !isActive) return null;

  const summary = buildSummary(thoughts);
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  // Merge tool_start/tool_result pairs: when a tool_result exists for a source,
  // skip the tool_start so we don't show both spinner and check for the same tool.
  const mergedThoughts = (() => {
    const completedSources = new Set<string>();
    for (const t of thoughts) {
      if (t.type === 'tool_result' && t.source) completedSources.add(t.source);
    }
    return thoughts.filter(t => {
      if (t.type === 'tool_start' && t.source && completedSources.has(t.source)) return false;
      return true;
    });
  })();

  return (
    <div className="w-full">
      {/* Layer 1: Summary bar -- always visible */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-1.5 w-full text-left text-xs cursor-pointer text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded transition-colors"
      >
        <Wrench className="w-3 h-3 flex-shrink-0" />
        <span className="font-medium">
          {isActive ? 'Working' : 'Used'} {summary}
        </span>
        {isActive && <Loader2 className="w-3 h-3 animate-spin ml-0.5" />}
        <Chevron className="w-3 h-3 ml-auto flex-shrink-0" />
      </button>

      {/* Layer 2: Step-by-step events */}
      {isOpen && (
        <div className="mt-1.5 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded text-xs space-y-1 max-h-64 overflow-y-auto transition-all">
          {mergedThoughts.map((thought, idx) => (
            <div key={idx} className={`flex items-start gap-2 ${getEventColor(thought.type)}`}>
              <span className="mt-0.5">{getEventIcon(thought.type)}</span>
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[10px] text-gray-500 dark:text-gray-500 mr-1.5">
                  {getSourceIcon(thought.source || '')}
                  {thought.source || 'system'}
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {thought.message || '...'}
                </span>
              </div>
            </div>
          ))}
          {isActive && thoughts.length === 0 && (
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Starting...</span>
            </div>
          )}

          {/* Layer 3: Raw trace toggle */}
          {thoughts.length > 0 && (
            <div className="mt-2 pt-1.5 border-t border-purple-200 dark:border-purple-700">
              <button
                type="button"
                onClick={() => setShowRawTrace(prev => !prev)}
                className="text-[10px] text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
              >
                {showRawTrace ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                Raw trace
              </button>
              {showRawTrace && (
                <pre className="mt-1 p-1.5 bg-gray-100 dark:bg-gray-900 rounded overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto text-[10px] text-gray-600 dark:text-gray-400 font-mono">
                  {JSON.stringify(thoughts.map(t => ({
                    type: t.type,
                    source: t.source,
                    message: t.message,
                    ...(t.data ? { data: t.data } : {}),
                  })), null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ThinkingToggle;
