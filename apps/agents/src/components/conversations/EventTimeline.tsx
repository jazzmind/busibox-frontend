'use client';

import React, { useState, useMemo } from 'react';
import { ToolCallCard } from './ToolCallCard';

interface RunEvent {
  timestamp: string;
  type: string;
  data?: Record<string, any>;
  error?: string;
}

interface EventTimelineProps {
  events: RunEvent[];
  /** Whether to use enhanced tool call display */
  enhancedToolDisplay?: boolean;
}

const EVENT_STYLES: Record<string, { bg: string; border: string; icon: string; label: string }> = {
  created: { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-400', icon: '📝', label: 'Created' },
  token_exchange_started: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-400', icon: '🔑', label: 'Token Exchange Started' },
  token_exchange_completed: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-400', icon: '✅', label: 'Token Exchange Completed' },
  token_exchange_skipped: { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-400', icon: '⏭️', label: 'Token Exchange Skipped' },
  token_provided: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-400', icon: '🔐', label: 'Token Provided' },
  agent_loaded: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-400', icon: '🤖', label: 'Agent Loaded' },
  execution_started: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-400', icon: '🚀', label: 'Execution Started' },
  execution_completed: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-400', icon: '✅', label: 'Execution Completed' },
  execution_failed: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-400', icon: '❌', label: 'Execution Failed' },
  timeout: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-400', icon: '⏰', label: 'Timeout' },
  tool_call: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-400', icon: '🔧', label: 'Tool Call' },
  tool_result: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-400', icon: '📤', label: 'Tool Result' },
  llm_request: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-400', icon: '📡', label: 'LLM Request' },
  llm_response: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-400', icon: '📨', label: 'LLM Response' },
  content_chunk: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-400', icon: '📝', label: 'Content Chunk' },
  error: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-400', icon: '⚠️', label: 'Error' },
  setup_failed: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-400', icon: '❌', label: 'Setup Failed' },
};

const DEFAULT_STYLE = { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-400', icon: '📌', label: 'Event' };

// Check if event is a tool-related event
const isToolEvent = (type: string) => type === 'tool_call' || type === 'tool_result';

// Convert tool_call/tool_result events to ToolCallCard format
const convertToToolCallData = (event: RunEvent, resultEvent?: RunEvent) => {
  const data = event.data || {};
  const resultData = resultEvent?.data || {};
  
  return {
    tool_name: data.tool_name || data.name || 'unknown_tool',
    input: data.input || data.args || data.arguments,
    output: resultData.output || resultData.result,
    status: resultEvent ? (resultData.error ? 'failed' : 'succeeded') : 'running',
    error: resultData.error || event.error,
    started_at: event.timestamp,
    completed_at: resultEvent?.timestamp,
    duration_ms: resultEvent 
      ? new Date(resultEvent.timestamp).getTime() - new Date(event.timestamp).getTime()
      : undefined,
  };
};

export function EventTimeline({ events, enhancedToolDisplay = true }: EventTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  // Group tool_call events with their corresponding tool_result events
  const processedEvents = useMemo(() => {
    type ProcessedEvent = {
      event: RunEvent;
      index: number;
      isToolPair: boolean;
      toolCallData?: ReturnType<typeof convertToToolCallData>;
      skipRender?: boolean;
    };

    if (!enhancedToolDisplay) return events.map((e, i): ProcessedEvent => ({ event: e, index: i, isToolPair: false, skipRender: false }));

    const result: ProcessedEvent[] = [];

    const toolResultIndices = new Set<number>();

    events.forEach((event, index) => {
      // If this is a tool_call, look for a matching tool_result
      if (event.type === 'tool_call') {
        // Find the next tool_result with matching tool name
        const toolName = event.data?.tool_name || event.data?.name;
        let matchingResultIndex = -1;
        
        for (let i = index + 1; i < events.length; i++) {
          if (events[i].type === 'tool_result') {
            const resultToolName = events[i].data?.tool_name || events[i].data?.name;
            if (!toolResultIndices.has(i) && (!toolName || !resultToolName || toolName === resultToolName)) {
              matchingResultIndex = i;
              toolResultIndices.add(i);
              break;
            }
          }
        }

        const resultEvent = matchingResultIndex >= 0 ? events[matchingResultIndex] : undefined;
        result.push({
          event,
          index,
          isToolPair: true,
          toolCallData: convertToToolCallData(event, resultEvent),
        });
      } else if (event.type === 'tool_result' && toolResultIndices.has(index)) {
        // Skip this event as it's been paired with a tool_call
        result.push({ event, index, isToolPair: false, skipRender: true });
      } else {
        result.push({ event, index, isToolPair: false });
      }
    });

    return result;
  }, [events, enhancedToolDisplay]);

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedEvents(newExpanded);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const getTimeDiff = (current: string, previous: string) => {
    const diff = new Date(current).getTime() - new Date(previous).getTime();
    if (diff < 1000) return `+${diff}ms`;
    if (diff < 60000) return `+${(diff / 1000).toFixed(2)}s`;
    return `+${(diff / 60000).toFixed(2)}m`;
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <div className="text-4xl mb-2">📋</div>
        <p>No events recorded for this run.</p>
      </div>
    );
  }

  // Find the actual previous non-skipped event for time diff calculation
  const getPreviousEvent = (currentIndex: number): RunEvent | null => {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (!processedEvents[i].skipRender) {
        return processedEvents[i].event;
      }
    }
    return null;
  };

  return (
    <div className="space-y-0">
      {processedEvents.map(({ event, index, isToolPair, toolCallData, skipRender }) => {
        // Skip rendering tool_result events that have been paired
        if (skipRender) return null;

        const style = EVENT_STYLES[event.type] || DEFAULT_STYLE;
        const isExpanded = expandedEvents.has(index);
        const hasData = event.data && Object.keys(event.data).length > 0;
        const hasError = !!event.error;
        const isExpandable = hasData || hasError;
        const prevEvent = getPreviousEvent(index);

        // Render enhanced tool call card for tool events
        if (isToolPair && toolCallData && enhancedToolDisplay) {
          return (
            <div key={index} className="relative">
              {/* Timeline connector */}
              {index > 0 && (
                <div className="absolute left-[19px] top-0 w-0.5 h-4 bg-gray-300 dark:bg-gray-600 -translate-y-4" />
              )}
              {index < events.length - 1 && (
                <div className="absolute left-[19px] bottom-0 w-0.5 h-4 bg-gray-300 dark:bg-gray-600 translate-y-4" />
              )}

              <div className="flex items-start gap-3">
                {/* Timeline dot */}
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-lg">
                  🔧
                </div>

                {/* Tool Call Card */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Tool Execution
                    </span>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {prevEvent && (
                        <span className="text-blue-500 dark:text-blue-400 font-mono">
                          {getTimeDiff(event.timestamp, prevEvent.timestamp)}
                        </span>
                      )}
                      <span className="font-mono">{formatTime(event.timestamp)}</span>
                    </div>
                  </div>
                  <ToolCallCard
                    toolCall={toolCallData as any}
                    defaultExpanded={false}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={index} className="relative">
            {/* Timeline connector */}
            {index > 0 && (
              <div className="absolute left-[19px] top-0 w-0.5 h-4 bg-gray-300 dark:bg-gray-600 -translate-y-4" />
            )}
            {index < events.length - 1 && (
              <div className="absolute left-[19px] bottom-0 w-0.5 h-4 bg-gray-300 dark:bg-gray-600 translate-y-4" />
            )}

            <div
              className={`relative flex items-start gap-3 p-3 rounded-lg ${style.bg} border-l-4 ${style.border} ${
                isExpandable ? 'cursor-pointer hover:shadow-sm' : ''
              }`}
              onClick={() => isExpandable && toggleExpand(index)}
            >
              {/* Icon */}
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-lg">
                {style.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {style.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {event.type}
                    </span>
                    {isExpandable && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {prevEvent && (
                      <span className="text-blue-500 dark:text-blue-400 font-mono">
                        {getTimeDiff(event.timestamp, prevEvent.timestamp)}
                      </span>
                    )}
                    <span className="font-mono">{formatTime(event.timestamp)}</span>
                    <span>{formatDate(event.timestamp)}</span>
                  </div>
                </div>

                {/* Quick preview */}
                {!isExpanded && hasData && (
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                    {Object.entries(event.data!).slice(0, 2).map(([key, value]) => (
                      <span key={key} className="mr-3">
                        <span className="text-gray-500 dark:text-gray-500">{key}:</span>{' '}
                        {typeof value === 'object' ? '[object]' : String(value).slice(0, 50)}
                      </span>
                    ))}
                    {Object.keys(event.data!).length > 2 && (
                      <span className="text-gray-400">+{Object.keys(event.data!).length - 2} more</span>
                    )}
                  </div>
                )}

                {/* Error preview */}
                {!isExpanded && hasError && (
                  <div className="mt-1 text-sm text-red-600 dark:text-red-400 truncate">
                    {event.error}
                  </div>
                )}

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-3 space-y-3">
                    {hasError && (
                      <div className="bg-red-100 dark:bg-red-900/30 rounded p-3">
                        <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Error</div>
                        <pre className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap font-mono">
                          {event.error}
                        </pre>
                      </div>
                    )}
                    {hasData && (
                      <div className="bg-white dark:bg-gray-900 rounded p-3 border border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Data</div>
                        <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono overflow-x-auto max-h-96 overflow-y-auto">
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
