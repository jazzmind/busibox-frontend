'use client';

/**
 * Task Execution Output Page
 * 
 * Renders ONLY the output content with clean formatting.
 * - Removes JSON/dict wrappers
 * - Renders markdown as HTML
 * - Minimal chrome for clean viewing/printing
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@jazzmind/busibox-app';
import { formatDateTime } from '@jazzmind/busibox-app/lib/date-utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface TaskExecution {
  id: string;
  task_id: string;
  status: string;
  output_summary?: string;
  output_data?: Record<string, any>;
  run_details?: {
    output?: Record<string, any> | string;
  };
  completed_at?: string;
  created_at: string;
}

interface Task {
  id: string;
  name: string;
}

/**
 * Extract clean content from various output formats.
 * Handles JSON wrappers, Python dict strings, markdown fences, and nested structures.
 */
function extractContent(output: string | undefined | null): string {
  if (!output) return '';
  
  let content = output.trim();
  
  // First, handle Python dict format (single quotes) by converting to JSON
  // Pattern: {'key': 'value'} or {"key": "value"}
  if ((content.startsWith('{') && content.endsWith('}')) || 
      (content.startsWith('[') && content.endsWith(']'))) {
    
    // Try JSON first
    try {
      const parsed = JSON.parse(content);
      content = extractFromParsed(parsed);
    } catch {
      // Try converting Python dict to JSON (single quotes to double quotes)
      try {
        // Replace single quotes with double quotes, being careful about nested quotes
        // This handles {'result': 'value'} -> {"result": "value"}
        const jsonified = content
          .replace(/'/g, '"')
          // Handle escaped quotes that might have been in the original
          .replace(/\\"/g, "\\'");
        
        const parsed = JSON.parse(jsonified);
        content = extractFromParsed(parsed);
      } catch {
        // Still not parseable, try regex extraction as last resort
        // Using [\s\S] instead of . with /s flag for compatibility
        const resultMatch = content.match(/['"]?result['"]?\s*:\s*['"](.+?)['"]?\s*\}$/);
        if (resultMatch) {
          content = resultMatch[1];
        }
      }
    }
  }
  
  // Handle escaped newlines (common in JSON strings)
  content = content.replace(/\\n/g, '\n');
  
  // Handle escaped quotes
  content = content.replace(/\\"/g, '"');
  content = content.replace(/\\'/g, "'");
  
  // Strip markdown code fences if the entire content is wrapped in them
  content = content.trim();
  if (content.startsWith('```')) {
    const lines = content.split('\n');
    if (lines.length > 1) {
      // Remove first line (```language or ```)
      lines.shift();
      // Remove last line if it's just closing fence
      if (lines[lines.length - 1]?.trim() === '```') {
        lines.pop();
      }
      content = lines.join('\n');
    }
  }
  
  return content.trim();
}

/**
 * Extract content from a parsed object, checking common wrapper fields.
 */
function extractFromParsed(parsed: any): string {
  if (typeof parsed === 'string') {
    return parsed;
  }
  
  if (typeof parsed !== 'object' || parsed === null) {
    return String(parsed);
  }
  
  // Check for common output wrapper fields in order of likelihood
  const possibleFields = ['result', 'output', 'content', 'response', 'summary', 'text', 'message', 'data', 'answer'];
  
  for (const field of possibleFields) {
    if (parsed[field] !== undefined) {
      const value = parsed[field];
      if (typeof value === 'string') {
        return value;
      } else if (typeof value === 'object') {
        // Recursively extract from nested object
        return extractFromParsed(value);
      }
    }
  }
  
  // If no known field found, return prettified JSON
  return JSON.stringify(parsed, null, 2);
}

/**
 * Detect if user prefers dark mode
 */
function useIsDarkMode() {
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    // Check for dark class on document
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    checkDark();
    
    // Watch for changes
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, []);
  
  return isDark;
}

export default function ExecutionOutputPage() {
  const params = useParams();
  const { isReady } = useAuth();
  const isDarkMode = useIsDarkMode();
  
  const taskId = params.id as string;
  const execId = params.execId as string;
  
  const [execution, setExecution] = useState<TaskExecution | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    loadData();
  }, [isReady, taskId, execId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch execution and task in parallel
      const [execResponse, taskResponse] = await Promise.all([
        fetch(`/api/tasks/${taskId}/executions/${execId}`),
        fetch(`/api/tasks/${taskId}`),
      ]);
      
      if (!execResponse.ok) {
        const errData = await execResponse.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load execution');
      }
      
      const execData = await execResponse.json();
      setExecution(execData);
      
      if (taskResponse.ok) {
        const taskData = await taskResponse.json();
        setTask(taskData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load execution');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Error</h3>
          <p className="text-red-600 dark:text-red-300">{error || 'Execution not found'}</p>
          <Link
            href={`/tasks/${taskId}`}
            className="mt-4 inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Back to Task
          </Link>
        </div>
      </div>
    );
  }

  // Prefer full output_data over the truncated output_summary (which is for notifications)
  const rawOutput = (() => {
    if (execution.output_data) {
      // For workflow executions, output_data is: {workflow_execution_id, step_outputs: {step1: {...}, synthesize: {result: "..."}}}
      // Extract the final step output (synthesize > result > last step)
      const stepOutputs = execution.output_data.step_outputs;
      if (stepOutputs && typeof stepOutputs === 'object') {
        const finalStep = stepOutputs.synthesize || stepOutputs.result || 
          Object.values(stepOutputs).pop();
        if (finalStep) {
          return typeof finalStep === 'string' ? finalStep : JSON.stringify(finalStep);
        }
      }
      // Fall back to stringifying the whole output_data
      return typeof execution.output_data === 'string' ? execution.output_data : JSON.stringify(execution.output_data);
    }
    if (execution.run_details?.output) {
      return typeof execution.run_details.output === 'string'
        ? execution.run_details.output
        : JSON.stringify(execution.run_details.output);
    }
    return execution.output_summary;
  })();
  const outputContent = extractContent(rawOutput);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 print:py-4 print:px-0">
      {/* Minimal Header - hidden when printing */}
      <div className="mb-6 print:mb-4">
        <div className="flex items-center justify-between mb-3 print:hidden">
          <Link
            href={`/tasks/${taskId}/executions/${execId}`}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Full Details
          </Link>
          <button
            onClick={() => window.print()}
            className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
          >
            Print / Save PDF
          </button>
        </div>
        
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {task?.name || 'Task Output'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {formatDateTime(execution.completed_at || execution.created_at)}
          {execution.status === 'succeeded' && (
            <span className="ml-2 text-green-600 dark:text-green-400">✓ Completed</span>
          )}
          {execution.status === 'failed' && (
            <span className="ml-2 text-red-600 dark:text-red-400">✗ Failed</span>
          )}
        </p>
      </div>

      {/* Output Content */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        {outputContent ? (
          <article className="prose prose-slate dark:prose-invert max-w-none
            prose-headings:font-semibold
            prose-h1:text-2xl prose-h1:mt-6 prose-h1:mb-4
            prose-h2:text-xl prose-h2:mt-5 prose-h2:mb-3
            prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2
            prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed
            prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-gray-900 dark:prose-strong:text-gray-100
            prose-em:text-gray-700 dark:prose-em:text-gray-300
            prose-ul:my-4 prose-ol:my-4
            prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-li:my-1
            prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 dark:prose-blockquote:bg-blue-900/20 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic
            prose-code:text-sm prose-code:font-mono
            prose-code:before:content-none prose-code:after:content-none
            prose-pre:my-4 prose-pre:rounded-lg prose-pre:shadow-md
            prose-img:rounded-lg prose-img:shadow-md
            prose-hr:border-gray-300 dark:prose-hr:border-gray-600
            prose-table:border-collapse
            prose-th:bg-gray-100 dark:prose-th:bg-gray-700 prose-th:px-4 prose-th:py-2 prose-th:text-left
            prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:px-4 prose-td:py-2
          ">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom code block rendering with syntax highlighting
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';
                  const codeString = String(children).replace(/\n$/, '');
                  
                  if (!inline && (language || codeString.includes('\n'))) {
                    return (
                      <SyntaxHighlighter
                        style={isDarkMode ? oneDark : oneLight}
                        language={language || 'text'}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                        }}
                        {...props}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    );
                  }
                  
                  // Inline code
                  return (
                    <code 
                      className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                // Better pre tag handling
                pre({ children, ...props }: any) {
                  return (
                    <div className="relative my-4" {...props}>
                      {children}
                    </div>
                  );
                },
              }}
            >
              {outputContent}
            </ReactMarkdown>
          </article>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 italic">
              No output available for this execution.
            </p>
            {execution.status === 'failed' && (
              <Link
                href={`/tasks/${taskId}/executions/${execId}`}
                className="mt-4 inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                View error details →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Footer - hidden when printing */}
      <div className="mt-6 text-xs text-gray-400 dark:text-gray-500 print:hidden">
        Execution ID: {execution.id}
      </div>
    </div>
  );
}
