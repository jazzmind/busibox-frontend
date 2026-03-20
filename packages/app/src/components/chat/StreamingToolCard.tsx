'use client';

import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { MessagePart } from '../../types/chat';

/**
 * Inline tool-call card for the streaming area -- lightweight version
 * that shows status, name, and result as they arrive in real time.
 */
export function StreamingToolCard({ part }: { part: Extract<MessagePart, { type: 'tool_call' }> }) {
  const isRunning = part.status === 'running' || part.status === 'pending';
  const isError = part.status === 'error';

  const duration = part.startedAt && part.completedAt
    ? Math.round((part.completedAt.getTime() - part.startedAt.getTime()) / 1000 * 10) / 10
    : null;

  return (
    <div className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
      isRunning
        ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20'
        : isError
          ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20'
          : 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20'
    } mb-1.5`}>
      {isRunning ? (
        <Loader2 className="w-3 h-3 text-blue-500 animate-spin flex-shrink-0" />
      ) : isError ? (
        <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
      ) : (
        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
      )}
      <span className={`font-medium ${
        isRunning ? 'text-blue-700 dark:text-blue-300' : isError ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'
      }`}>
        {part.displayName || part.name}
      </span>
      {part.output && !isError && (
        <span className="text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{part.output.slice(0, 80)}</span>
      )}
      {part.error && (
        <span className="text-red-600 dark:text-red-400 truncate max-w-[200px]">{part.error}</span>
      )}
      {duration !== null && (
        <span className="ml-auto text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">{duration}s</span>
      )}
    </div>
  );
}
