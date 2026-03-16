'use client';
/**
 * ThinkingSection Component
 * 
 * A collapsible section that displays agent reasoning/thoughts during execution.
 * Used in both SimpleChatInterface and FullChatInterface for consistent display
 * of the AI's chain-of-thought process.
 */


import { useState, useRef, useEffect } from 'react';
import { Brain, Bot, ChevronRight, Loader2, Search, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Represents a single thought/event in the execution process
 */
export interface ThoughtEvent {
  type: string;
  source?: string;
  message?: string;
  data?: any;
  timestamp?: Date;
}

export interface ThinkingSectionProps {
  /** Array of thought events to display */
  thoughts: ThoughtEvent[];
  /** Whether the thinking process is currently active */
  isActive: boolean;
  /** Whether to start collapsed (useful when streaming content has started) */
  defaultCollapsed?: boolean;
  /** Optional class name for additional styling */
  className?: string;
}

/**
 * Preprocesses content to ensure LaTeX is properly delimited
 * Converts LaTeX bracket notation \[ \] and \( \) to $ delimiters for KaTeX
 */
function preprocessLatex(content: string): string {
  let processed = content;
  
  // Convert \[ ... \] (display math) to $$ ... $$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, inner) => {
    return `$$${inner}$$`;
  });
  
  // Convert \( ... \) (inline math) to $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_match, inner) => {
    return `$${inner}$`;
  });
  
  return processed;
}

/**
 * Get icon for source type
 */
function getSourceIcon(source: string) {
  if (source?.toLowerCase().includes('search')) return <Search className="w-3 h-3" />;
  if (source?.toLowerCase().includes('scraper')) return <FileText className="w-3 h-3" />;
  if (source?.toLowerCase().includes('dispatcher')) return <Brain className="w-3 h-3" />;
  return <Bot className="w-3 h-3" />;
}

/**
 * Get color class for event type
 */
function getEventColor(type: string): string {
  switch (type) {
    case 'thought': return 'text-purple-600 dark:text-purple-400';
    case 'tool_start': return 'text-blue-600 dark:text-blue-400';
    case 'tool_result': return 'text-green-600 dark:text-green-400';
    case 'error': return 'text-red-600 dark:text-red-400';
    default: return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * ThinkingSection - Collapsible display of agent thoughts/reasoning
 */
export function ThinkingSection({ 
  thoughts, 
  isActive,
  defaultCollapsed = false,
  className = '',
}: ThinkingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-expand when active (and not defaultCollapsed), auto-scroll to bottom
  useEffect(() => {
    if (isActive && !defaultCollapsed) {
      setIsExpanded(true);
    }
    // Auto-collapse when defaultCollapsed changes to true (streaming started)
    if (defaultCollapsed) {
      setIsExpanded(false);
    }
    // Auto-scroll to bottom of thoughts
    if (scrollRef.current && isActive && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isActive, thoughts, defaultCollapsed, isExpanded]);

  if (thoughts.length === 0 && !isActive) return null;

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg mb-3 overflow-hidden bg-gray-50 dark:bg-gray-800/50 ${className}`}>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 p-2.5 w-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <ChevronRight 
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
        />
        <Brain className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {isActive ? 'Thinking...' : 'View reasoning'}
        </span>
        {isActive && (
          <Loader2 className="w-3 h-3 animate-spin ml-auto text-purple-500" />
        )}
        {!isActive && thoughts.length > 0 && (
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
            {thoughts.length} steps
          </span>
        )}
      </button>
      
      {isExpanded && (
        <div 
          ref={scrollRef}
          className="p-3 space-y-2 max-h-64 overflow-y-auto border-t border-gray-200 dark:border-gray-700"
        >
          {thoughts.map((thought, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className={`flex items-center gap-1 font-mono text-xs whitespace-nowrap ${getEventColor(thought.type)}`}>
                {getSourceIcon(thought.source || '')}
                <span className="opacity-70">{thought.source || 'system'}:</span>
              </span>
              <div className="prose prose-sm dark:prose-invert max-w-none flex-1 text-gray-700 dark:text-gray-300">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {preprocessLatex(thought.message || '...')}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {isActive && thoughts.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Starting...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ThinkingSection;
