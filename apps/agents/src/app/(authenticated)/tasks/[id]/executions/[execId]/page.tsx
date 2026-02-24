'use client';

/**
 * Task Execution Detail Page
 * 
 * Shows full details of a task execution including:
 * - Execution status and metadata
 * - Complete output (not truncated)
 * - Event timeline from agent run
 * - Notification history
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { formatDateTime, formatTime, formatDuration } from '@jazzmind/busibox-app/lib/date-utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TaskExecution {
  id: string;
  task_id: string;
  run_id?: string;
  trigger_source: string;
  status: string;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  output_summary?: string;
  notification_sent: boolean;
  notification_error?: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  error?: string;
  created_at: string;
  run_details?: {
    id: string;
    agent_id: string;
    status: string;
    input: Record<string, any>;
    output?: Record<string, any>;
    events: Array<{
      timestamp: string;
      type: string;
      data?: Record<string, any>;
      error?: string;
    }>;
    created_at: string;
    updated_at: string;
  };
}

interface Task {
  id: string;
  name: string;
  description?: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'succeeded': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'timeout': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getEventIcon = (type: string) => {
  switch (type) {
    case 'created': return '🆕';
    case 'token_exchange_started': return '🔑';
    case 'token_exchange_completed': return '✅';
    case 'token_provided': return '🎫';
    case 'token_exchange_skipped': return '⏭️';
    case 'agent_loaded': return '🤖';
    case 'execution_started': return '▶️';
    case 'execution_completed': return '✅';
    case 'execution_failed': return '❌';
    case 'tool_call': return '🔧';
    case 'tool_result': return '📋';
    case 'timeout': return '⏱️';
    case 'error': return '❌';
    case 'setup_failed': return '⚠️';
    case 'content_chunk': return '📝';
    case 'thought': return '💭';
    default: return '📍';
  }
};

export default function ExecutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isReady } = useSession();
  
  const taskId = params.id as string;
  const execId = params.execId as string;
  
  const [execution, setExecution] = useState<TaskExecution | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'output' | 'events' | 'raw'>('output');

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
        throw new Error('Failed to load execution');
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

  // Extract clean content from output summary
  const extractContent = (output: string | undefined): string => {
    if (!output) return '';
    
    let content = output.trim();
    
    // Handle JSON or Python dict format
    if ((content.startsWith('{') && content.endsWith('}')) || 
        (content.startsWith('[') && content.endsWith(']'))) {
      
      // Try JSON first
      try {
        const parsed = JSON.parse(content);
        content = extractFromParsed(parsed);
      } catch {
        // Try converting Python dict to JSON (single quotes to double quotes)
        try {
          const jsonified = content.replace(/'/g, '"').replace(/\\"/g, "\\'");
          const parsed = JSON.parse(jsonified);
          content = extractFromParsed(parsed);
        } catch {
          // Try regex extraction as last resort
          const resultMatch = content.match(/['"]?result['"]?\s*:\s*['"](.+?)['"]?\s*\}$/);
          if (resultMatch) {
            content = resultMatch[1];
          }
        }
      }
    }
    
    // Handle escaped newlines
    content = content.replace(/\\n/g, '\n');
    content = content.replace(/\\"/g, '"');
    content = content.replace(/\\'/g, "'");
    
    // Strip markdown code fences if present
    content = content.trim();
    if (content.startsWith('```')) {
      const lines = content.split('\n');
      if (lines.length > 1) {
        lines.shift(); // Remove first line (```markdown or ```)
        if (lines[lines.length - 1]?.trim() === '```') {
          lines.pop(); // Remove last line (```)
        }
        content = lines.join('\n');
      }
    }
    
    return content.trim();
  };
  
  // Helper to extract content from parsed object
  const extractFromParsed = (parsed: any): string => {
    if (typeof parsed === 'string') return parsed;
    if (typeof parsed !== 'object' || parsed === null) return String(parsed);
    
    const possibleFields = ['result', 'output', 'content', 'response', 'summary', 'text', 'message', 'data', 'answer'];
    for (const field of possibleFields) {
      if (parsed[field] !== undefined) {
        const value = parsed[field];
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return extractFromParsed(value);
      }
    }
    return JSON.stringify(parsed, null, 2);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Error</h3>
          <p className="text-red-600 dark:text-red-300">{error || 'Execution not found'}</p>
          <Link
            href={`/tasks/${taskId}`}
            className="mt-4 inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Back to Task
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
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-sm text-gray-600 dark:text-gray-400">
          <Link href="/tasks" className="hover:text-blue-600 dark:hover:text-blue-400">
            Tasks
          </Link>
          <span>/</span>
          <Link href={`/tasks/${taskId}`} className="hover:text-blue-600 dark:hover:text-blue-400">
            {task?.name || 'Task'}
          </Link>
          <span>/</span>
          <span>Execution</span>
        </div>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Execution Details
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {task?.name} - {formatDateTime(execution.created_at)}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              href={`/tasks/${taskId}/executions/${execId}/output`}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              View Output Only
            </Link>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(execution.status)}`}>
              {execution.status}
            </span>
          </div>
        </div>
      </div>

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Trigger</h3>
          <p className="mt-1 text-lg text-gray-900 dark:text-gray-100">{execution.trigger_source}</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration</h3>
          <p className="mt-1 text-lg text-gray-900 dark:text-gray-100">
            {execution.duration_seconds ? formatDuration(execution.duration_seconds) : 'N/A'}
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Notification</h3>
          <p className="mt-1 text-lg text-gray-900 dark:text-gray-100">
            {execution.notification_sent ? (
              <span className="text-green-600 dark:text-green-400">Sent ✓</span>
            ) : execution.notification_error ? (
              <span className="text-red-600 dark:text-red-400">Failed</span>
            ) : (
              <span className="text-gray-400">Not sent</span>
            )}
          </p>
        </div>
      </div>

      {/* Error Display */}
      {execution.error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">Error</h3>
          <pre className="text-red-700 dark:text-red-300 text-sm whitespace-pre-wrap overflow-x-auto">
            {execution.error}
          </pre>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('output')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'output'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Output
          </button>
          {execution.run_details?.events && execution.run_details.events.length > 0 && (
            <button
              onClick={() => setActiveTab('events')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'events'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              Events ({execution.run_details.events.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'raw'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Raw Data
          </button>
        </div>

        <div className="p-6">
          {/* Output Tab */}
          {activeTab === 'output' && (
            <div>
              {outputContent ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {outputContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  No output available for this execution.
                </p>
              )}
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && execution.run_details?.events && (
            <div className="space-y-3">
              {execution.run_details.events.map((event, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    event.type.includes('error') || event.type.includes('failed')
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      : event.type.includes('completed') || event.type.includes('succeeded')
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{getEventIcon(event.type)}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {event.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs ml-auto">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                  
                  {event.error && (
                    <pre className="mt-2 text-red-600 dark:text-red-400 text-sm whitespace-pre-wrap bg-red-100 dark:bg-red-900/30 p-2 rounded">
                      {event.error}
                    </pre>
                  )}
                  
                  {event.data && Object.keys(event.data).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100">
                        View data
                      </summary>
                      <pre className="mt-2 text-gray-600 dark:text-gray-400 text-xs whitespace-pre-wrap bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Raw Data Tab */}
          {activeTab === 'raw' && (
            <div className="space-y-4">
              {execution.input_data && Object.keys(execution.input_data).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Input Data</h4>
                  <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(execution.input_data, null, 2)}
                  </pre>
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Output Summary (Raw)</h4>
                <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                  {execution.output_summary || 'No output'}
                </pre>
              </div>
              
              {execution.output_data && Object.keys(execution.output_data).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Output Data</h4>
                  <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(execution.output_data, null, 2)}
                  </pre>
                </div>
              )}
              
              {execution.run_details && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Run Details</h4>
                  <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto max-h-96 overflow-y-auto">
                    {JSON.stringify(execution.run_details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metadata Footer */}
      <div className="mt-6 text-sm text-gray-500 dark:text-gray-400 space-y-1">
        <p>Execution ID: {execution.id}</p>
        {execution.run_id && <p>Run ID: {execution.run_id}</p>}
        <p>Started: {execution.started_at ? formatDateTime(execution.started_at) : 'N/A'}</p>
        <p>Completed: {execution.completed_at ? formatDateTime(execution.completed_at) : 'N/A'}</p>
      </div>

      {/* Back Link */}
      <div className="mt-6">
        <Link
          href={`/tasks/${taskId}`}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Task
        </Link>
      </div>
    </div>
  );
}
