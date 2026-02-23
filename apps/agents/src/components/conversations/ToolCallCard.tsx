/**
 * ToolCallCard Component
 * 
 * Expandable card for displaying tool call details in conversations and runs.
 * Shows tool name and status when collapsed, full input/output when expanded.
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getToolIcon } from '@/components/tools';
import { formatTime } from '@jazzmind/busibox-app/lib/date-utils';

interface ToolCallData {
  /** Tool name */
  tool_name: string;
  /** Tool input parameters */
  input?: Record<string, any>;
  /** Tool output/result */
  output?: Record<string, any> | string | null;
  /** Execution status */
  status?: 'pending' | 'running' | 'succeeded' | 'failed';
  /** Error message if failed */
  error?: string | null;
  /** Execution duration in milliseconds */
  duration_ms?: number;
  /** Start timestamp */
  started_at?: string;
  /** End timestamp */
  completed_at?: string;
}

interface ToolCallCardProps {
  /** Tool call data */
  toolCall: ToolCallData;
  /** Whether to start expanded */
  defaultExpanded?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Optional className */
  className?: string;
}

// Status styling
const STATUS_STYLES = {
  pending: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
    icon: '⏳',
  },
  running: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    icon: '🔄',
  },
  succeeded: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    icon: '✓',
  },
  failed: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    icon: '✗',
  },
};

export function ToolCallCard({
  toolCall,
  defaultExpanded = false,
  size = 'md',
  className = '',
}: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const status = toolCall.status || (toolCall.error ? 'failed' : 'succeeded');
  const statusStyle = STATUS_STYLES[status];
  
  // Format input/output for display
  const formatJson = (data: any): string => {
    if (data === null || data === undefined) return 'null';
    if (typeof data === 'string') return data;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  // Get a brief summary of the input
  const getInputSummary = (): string => {
    if (!toolCall.input) return 'No input';
    const keys = Object.keys(toolCall.input);
    if (keys.length === 0) return 'No input';
    if (keys.length === 1) {
      const value = toolCall.input[keys[0]];
      if (typeof value === 'string' && value.length <= 50) {
        return `${keys[0]}: "${value}"`;
      }
    }
    return `${keys.length} parameter${keys.length > 1 ? 's' : ''}`;
  };

  // Get a brief summary of the output
  const getOutputSummary = (): string => {
    if (!toolCall.output) return status === 'succeeded' ? 'Completed' : 'No output';
    if (typeof toolCall.output === 'string') {
      return toolCall.output.length > 50 
        ? toolCall.output.substring(0, 50) + '...' 
        : toolCall.output;
    }
    if (typeof toolCall.output === 'object') {
      // Try to find a meaningful summary field
      const output = toolCall.output as Record<string, any>;
      if (output.found !== undefined) {
        return output.found ? `Found ${output.result_count || 'results'}` : 'No results found';
      }
      if (output.success !== undefined) {
        return output.success ? 'Success' : 'Failed';
      }
      const keys = Object.keys(output);
      return `${keys.length} field${keys.length > 1 ? 's' : ''}`;
    }
    return 'Result available';
  };

  const sizeClasses = {
    sm: {
      container: 'text-xs',
      padding: 'p-2',
      icon: 'w-4 h-4',
      gap: 'gap-2',
    },
    md: {
      container: 'text-sm',
      padding: 'p-3',
      icon: 'w-5 h-5',
      gap: 'gap-3',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div
      className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full ${sizes.padding} flex items-center ${sizes.gap} bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left`}
      >
        {/* Tool Icon */}
        <div className={`${statusStyle.bg} ${statusStyle.text} p-1.5 rounded-md flex-shrink-0`}>
          {getToolIcon(toolCall.tool_name)}
        </div>

        {/* Tool Info */}
        <div className={`flex-1 min-w-0 ${sizes.container}`}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {toolCall.tool_name}
            </span>
            <span className={`${statusStyle.bg} ${statusStyle.text} px-1.5 py-0.5 rounded text-xs font-medium`}>
              {statusStyle.icon} {status}
            </span>
            {toolCall.duration_ms && (
              <span className="text-gray-500 dark:text-gray-400 text-xs">
                {toolCall.duration_ms}ms
              </span>
            )}
          </div>
          {!isExpanded && (
            <div className="text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {getInputSummary()} → {getOutputSummary()}
            </div>
          )}
        </div>

        {/* Expand/Collapse Icon */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className={`${sizes.padding} border-t border-gray-200 dark:border-gray-700 space-y-3`}>
          {/* Error */}
          {toolCall.error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-xs">
              <span className="font-medium">Error:</span> {toolCall.error}
            </div>
          )}

          {/* Input */}
          {toolCall.input && Object.keys(toolCall.input).length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Input</div>
              <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto text-gray-800 dark:text-gray-200">
                {formatJson(toolCall.input)}
              </pre>
            </div>
          )}

          {/* Output */}
          {toolCall.output && (
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Output</div>
              <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto max-h-60 overflow-y-auto text-gray-800 dark:text-gray-200">
                {formatJson(toolCall.output)}
              </pre>
            </div>
          )}

          {/* Timestamps */}
          {(toolCall.started_at || toolCall.completed_at) && (
            <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
              {toolCall.started_at && (
                <span>
                  Started: {formatTime(toolCall.started_at)}
                </span>
              )}
              {toolCall.completed_at && (
                <span>
                  Completed: {formatTime(toolCall.completed_at)}
                </span>
              )}
            </div>
          )}

          {/* Link to tool */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <Link
              href={`/tools?search=${encodeURIComponent(toolCall.tool_name)}`}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              View tool details →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ToolCallList Component
 * 
 * Renders a list of tool calls with consistent styling
 */
interface ToolCallListProps {
  toolCalls: ToolCallData[];
  defaultExpanded?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ToolCallList({
  toolCalls,
  defaultExpanded = false,
  size = 'md',
  className = '',
}: ToolCallListProps) {
  if (!toolCalls || toolCalls.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic py-2">
        No tool calls
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {toolCalls.map((toolCall, index) => (
        <ToolCallCard
          key={`${toolCall.tool_name}-${index}`}
          toolCall={toolCall}
          defaultExpanded={defaultExpanded}
          size={size}
        />
      ))}
    </div>
  );
}
