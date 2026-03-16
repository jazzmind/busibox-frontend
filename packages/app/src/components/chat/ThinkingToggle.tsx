'use client';
/**
 * ThinkingToggle Component
 * 
 * An inline collapsible toggle that displays agent reasoning/thoughts.
 * Designed to be used as a debug toggle in MessageList alongside Raw, Request, etc.
 */


import { Brain, Bot, Search, FileText } from 'lucide-react';

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
  /** Array of thought events to display */
  thoughts: ThoughtEvent[];
  /** Whether the thinking process is currently active (shows loading state) */
  isActive?: boolean;
  /** Whether the toggle should be open by default (useful for streaming) */
  defaultOpen?: boolean;
}

/**
 * Get icon for source type
 */
function getSourceIcon(source: string) {
  if (source?.toLowerCase().includes('search')) return <Search className="w-3 h-3 inline mr-1" />;
  if (source?.toLowerCase().includes('scraper')) return <FileText className="w-3 h-3 inline mr-1" />;
  if (source?.toLowerCase().includes('dispatcher')) return <Brain className="w-3 h-3 inline mr-1" />;
  return <Bot className="w-3 h-3 inline mr-1" />;
}

/**
 * Get color class for event type
 */
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
 * ThinkingToggle - Inline collapsible display of agent thoughts/reasoning
 * Uses native HTML details/summary for consistent behavior with other toggles
 */
export function ThinkingToggle({ thoughts, isActive = false, defaultOpen = false }: ThinkingToggleProps) {
  if (thoughts.length === 0 && !isActive) return null;

  return (
    <details className="inline" open={defaultOpen || isActive}>
      <summary className="cursor-pointer text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded">
        🧠 Thinking ({thoughts.length}){isActive && '...'}
      </summary>
      <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded text-xs space-y-1 max-h-64 overflow-y-auto">
        {thoughts.map((thought, idx) => (
          <div key={idx} className="flex gap-2">
            <span className={`font-mono whitespace-nowrap ${getEventColor(thought.type)}`}>
              {getSourceIcon(thought.source || '')}
              {thought.source || 'system'}:
            </span>
            <span className="text-gray-700 dark:text-gray-300 flex-1">
              {thought.message || '...'}
            </span>
          </div>
        ))}
        {isActive && thoughts.length === 0 && (
          <div className="text-gray-500 dark:text-gray-400">Starting...</div>
        )}
      </div>
    </details>
  );
}

export default ThinkingToggle;
