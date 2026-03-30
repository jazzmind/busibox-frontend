'use client';

import { useState, useEffect, useRef } from 'react';
import { Brain, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { ThoughtEvent } from '../../types/chat';

interface ThinkingStreamProps {
  thoughts: ThoughtEvent[];
  isActive: boolean;
}

/**
 * Live-streaming thinking display that shows model reasoning as it arrives.
 * Automatically collapses into a summary when content starts streaming,
 * but stays expanded while thinking is the only activity.
 */
export function ThinkingStream({ thoughts, isActive }: ThinkingStreamProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [wasManuallyToggled, setWasManuallyToggled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const thinkingThoughts = thoughts.filter(
    t => t.type === 'thought' && t.data?.phase === 'model_reasoning'
  );
  const latestThinking = thinkingThoughts[thinkingThoughts.length - 1];
  const isStreaming = isActive && latestThinking?.data?.streaming === true;

  useEffect(() => {
    if (wasManuallyToggled) return;
    if (isActive && thinkingThoughts.length > 0) {
      setIsExpanded(true);
    }
  }, [isActive, thinkingThoughts.length, wasManuallyToggled]);

  useEffect(() => {
    if (isExpanded && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [isExpanded, thinkingThoughts]);

  if (thinkingThoughts.length === 0) return null;

  const combinedThinking = thinkingThoughts
    .map(t => t.message || '')
    .filter(Boolean)
    .join('');

  const handleToggle = () => {
    setWasManuallyToggled(true);
    setIsExpanded(prev => !prev);
  };

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
      >
        <Brain className="w-3 h-3" />
        <span className="font-medium">
          {isStreaming ? 'Thinking...' : 'Thought process'}
        </span>
        {isStreaming && <Loader2 className="w-3 h-3 animate-spin" />}
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>

      {isExpanded && (
        <div
          ref={containerRef}
          className="mt-1 px-3 py-2 bg-purple-50/50 dark:bg-purple-900/20 border-l-2 border-purple-300 dark:border-purple-700 rounded-r text-xs text-purple-800 dark:text-purple-200 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed"
        >
          {combinedThinking}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3 bg-purple-400 dark:bg-purple-500 animate-pulse ml-0.5" />
          )}
        </div>
      )}
    </div>
  );
}
