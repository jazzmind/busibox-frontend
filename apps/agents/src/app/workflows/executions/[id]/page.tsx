'use client';

/**
 * Workflow Execution Detail Page
 * Shows detailed execution progress, steps, usage metrics
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDateTime } from '@jazzmind/busibox-app/lib/date-utils';

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: string;
  trigger_source: string;
  input_data: any;
  step_outputs: any;
  usage_requests: number;
  usage_input_tokens: number;
  usage_output_tokens: number;
  usage_tool_calls: number;
  estimated_cost_dollars: number;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  error?: string;
}

interface StepExecution {
  id: string;
  step_id: string;
  status: string;
  input_data?: any;
  output_data?: any;
  usage_requests: number;
  usage_input_tokens: number;
  usage_output_tokens: number;
  estimated_cost_dollars: number;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  error?: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'stopped': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'awaiting_human': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return '✅';
    case 'running': return '🔄';
    case 'failed': return '❌';
    case 'pending': return '⏳';
    case 'stopped': return '⏹️';
    case 'awaiting_human': return '👤';
    default: return '❓';
  }
};

export default function ExecutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const executionId = params.id as string;

  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [steps, setSteps] = useState<StepExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    loadExecution();
    loadSteps();

    // Poll for updates if execution is running
    const interval = setInterval(() => {
      if (execution?.status === 'pending' || execution?.status === 'running' || execution?.status === 'awaiting_human') {
        loadExecution();
        loadSteps();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [executionId, execution?.status]);

  const loadExecution = async () => {
    try {
      const response = await fetch(`/api/workflows/executions/${executionId}`);
      if (!response.ok) throw new Error('Failed to load execution');
      const data = await response.json();
      setExecution(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load execution');
    } finally {
      setLoading(false);
    }
  };

  const loadSteps = async () => {
    try {
      const response = await fetch(`/api/workflows/executions/${executionId}/steps`);
      if (!response.ok) throw new Error('Failed to load steps');
      const data = await response.json();
      setSteps(data);
    } catch (err) {
      console.error('Failed to load steps:', err);
    }
  };

  // Stop a running execution
  const handleStop = async () => {
    if (!execution || stopping) return;
    setStopping(true);

    try {
      const res = await fetch(`/api/workflows/executions/${executionId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to stop execution');

      // Update execution state
      setExecution(data);
      setError(null);
    } catch (err) {
      alert(`Stop failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setStopping(false);
    }
  };

  // Retry execution with same input data
  const handleRetry = async () => {
    if (!execution || retrying) return;
    setRetrying(true);

    try {
      const res = await fetch(`/api/workflows/${execution.workflow_id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_data: execution.input_data }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute');

      // Clear current steps and set up for the new execution
      setSteps([]);
      setExecution(data);
      setError(null);
      
      // Navigate to the new execution (this will trigger fresh data load)
      router.push(`/workflows/executions/${data.id}`);
    } catch (err) {
      alert(`Retry failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Error Loading Execution</h3>
          <p className="text-red-600 dark:text-red-300">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/workflows"
          className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
        >
          ← Back to Workflows
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Workflow Execution
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Execution ID: {execution.id}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-lg text-sm font-medium ${getStatusColor(execution.status)}`}>
              {getStatusIcon(execution.status)} {execution.status}
            </span>
            
            {/* Stop button - show for pending or running executions */}
            {(execution.status === 'pending' || execution.status === 'running') && (
              <button
                onClick={handleStop}
                disabled={stopping}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                title="Stop this execution"
              >
                {stopping ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Stopping...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    Stop
                  </>
                )}
              </button>
            )}
            
            {/* Retry button - show for completed, failed, or stopped executions */}
            {(execution.status === 'completed' || execution.status === 'failed' || execution.status === 'stopped') && execution.input_data && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                title="Run workflow again with the same input"
              >
                {retrying ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Retrying...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry
                  </>
                )}
              </button>
            )}
            
            {/* Link to workflow */}
            <Link
              href={`/workflows/${execution.workflow_id}`}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg text-sm font-medium transition-colors"
            >
              View Workflow
            </Link>
          </div>
        </div>
      </div>

      {/* Execution Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Trigger</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{execution.trigger_source}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Requests</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{execution.usage_requests}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Tokens</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {(execution.usage_input_tokens + execution.usage_output_tokens).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {execution.usage_input_tokens.toLocaleString()} in • {execution.usage_output_tokens.toLocaleString()} out
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Cost</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            ${execution.estimated_cost_dollars.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Timing */}
      {execution.duration_seconds && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-8">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Timing</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Started</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatDateTime(execution.started_at)}
              </p>
            </div>
            {execution.completed_at && (
              <>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatDateTime(execution.completed_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {execution.duration_seconds.toFixed(2)}s
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Input Data */}
      {execution.input_data && Object.keys(execution.input_data).length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-8">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Input</h3>
          {execution.input_data.query && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Query</p>
              <p className="text-blue-700 dark:text-blue-300">{execution.input_data.query}</p>
            </div>
          )}
          {Object.keys(execution.input_data).filter(k => k !== 'query').length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                Other input parameters
              </summary>
              <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-x-auto text-gray-800 dark:text-gray-200">
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(execution.input_data).filter(([k]) => k !== 'query')
                  ),
                  null,
                  2
                )}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Error */}
      {execution.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Execution Error</h3>
          <pre className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap">
            {execution.error}
          </pre>
        </div>
      )}

      {/* Final Output */}
      {execution.status === 'completed' && execution.step_outputs && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-8">
          <h3 className="text-green-800 dark:text-green-200 font-semibold mb-3">Final Output</h3>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {typeof execution.step_outputs === 'string' ? (
              <p className="text-green-700 dark:text-green-300 whitespace-pre-wrap">{execution.step_outputs}</p>
            ) : execution.step_outputs.final_output ? (
              <p className="text-green-700 dark:text-green-300 whitespace-pre-wrap">{execution.step_outputs.final_output}</p>
            ) : execution.step_outputs.summary ? (
              <p className="text-green-700 dark:text-green-300 whitespace-pre-wrap">{execution.step_outputs.summary}</p>
            ) : (
              <details>
                <summary className="cursor-pointer text-green-700 dark:text-green-300">View full output</summary>
                <pre className="mt-2 p-3 bg-green-100 dark:bg-green-900/40 rounded text-xs overflow-x-auto">
                  {JSON.stringify(execution.step_outputs, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Step Executions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Step Executions ({steps.length})
        </h2>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`bg-white dark:bg-gray-800 border rounded-lg p-4 transition-all ${
                step.status === 'running' 
                  ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' 
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      step.status === 'completed' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                        : step.status === 'running'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 animate-pulse'
                        : step.status === 'failed'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {step.status === 'running' ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </span>
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                      {step.step_id}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(step.status)}`}>
                      {getStatusIcon(step.status)} {step.status}
                    </span>
                  </div>
                </div>
                {step.duration_seconds !== undefined && step.duration_seconds !== null && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {step.duration_seconds.toFixed(2)}s
                  </span>
                )}
              </div>

              {/* Step Input - structured display based on step type */}
              {step.input_data && Object.keys(step.input_data).length > 0 && (
                <div className="mb-3 space-y-2">
                  {/* Tool step input */}
                  {step.input_data.tool && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-purple-700 dark:text-purple-300 font-medium">Tool Call:</span>
                        <code className="px-2 py-0.5 bg-purple-200 dark:bg-purple-800 rounded text-sm font-mono text-purple-800 dark:text-purple-200">
                          {step.input_data.tool}
                        </code>
                      </div>
                      {step.input_data.args && (
                        <details>
                          <summary className="cursor-pointer text-sm text-purple-600 dark:text-purple-400 hover:underline">
                            Arguments
                          </summary>
                          <pre className="mt-2 p-2 bg-purple-100 dark:bg-purple-900/40 rounded text-xs overflow-x-auto text-purple-800 dark:text-purple-200">
                            {JSON.stringify(step.input_data.args, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                  
                  {/* Agent step input */}
                  {step.input_data.agent && (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-indigo-700 dark:text-indigo-300 font-medium">Agent:</span>
                        <code className="px-2 py-0.5 bg-indigo-200 dark:bg-indigo-800 rounded text-sm font-mono text-indigo-800 dark:text-indigo-200">
                          {step.input_data.agent}
                        </code>
                      </div>
                      {step.input_data.prompt && (
                        <div className="mt-2">
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Prompt:</p>
                          <p className="text-sm text-indigo-700 dark:text-indigo-300 whitespace-pre-wrap bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded">
                            {String(step.input_data.prompt).substring(0, 500)}
                            {String(step.input_data.prompt).length > 500 && '...'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Condition step input */}
                  {step.input_data.condition && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
                      <span className="text-amber-700 dark:text-amber-300 font-medium">Condition:</span>
                      <pre className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                        {JSON.stringify(step.input_data.condition, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {/* Fallback for other inputs */}
                  {!step.input_data.tool && !step.input_data.agent && !step.input_data.condition && (
                    <details>
                      <summary className="cursor-pointer text-sm text-purple-600 dark:text-purple-400 hover:underline">
                        View Input
                      </summary>
                      <pre className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded text-xs overflow-x-auto text-purple-800 dark:text-purple-200">
                        {JSON.stringify(step.input_data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Step Metrics */}
              {(step.usage_requests > 0 || step.status === 'completed') && (
                <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Requests</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{step.usage_requests}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Tokens</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {(step.usage_input_tokens + step.usage_output_tokens).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Cost</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      ${step.estimated_cost_dollars.toFixed(4)}
                    </p>
                  </div>
                </div>
              )}

              {/* Step Output - structured display */}
              {step.output_data && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Output</p>
                  
                  {/* Web search output - special handling */}
                  {step.output_data.optimized_queries && (
                    <div className="space-y-2 mb-3">
                      <div>
                        <span className="text-xs text-green-600 dark:text-green-400">Original Query:</span>
                        <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                          {step.output_data.query}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-green-600 dark:text-green-400">Optimized Queries:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {step.output_data.optimized_queries.map((q: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-green-200 dark:bg-green-800 rounded text-xs font-mono text-green-800 dark:text-green-200">
                              {q}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-green-600 dark:text-green-400">Results:</span>
                        <span className="ml-2 text-sm text-green-800 dark:text-green-200">
                          {step.output_data.result_count || step.output_data.results?.length || 0} results from {step.output_data.providers_used?.join(', ') || 'unknown'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* URL extraction output */}
                  {step.output_data.urls && step.output_data.url_count !== undefined && (
                    <div className="space-y-2 mb-3">
                      <div>
                        <span className="text-xs text-green-600 dark:text-green-400">Extracted URLs:</span>
                        <span className="ml-2 text-sm font-medium text-green-800 dark:text-green-200">
                          {step.output_data.url_count} URLs
                        </span>
                      </div>
                      {step.output_data.original_query && (
                        <div>
                          <span className="text-xs text-green-600 dark:text-green-400">From query:</span>
                          <span className="ml-2 text-sm text-green-800 dark:text-green-200">
                            {step.output_data.original_query}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Show content/result if available (only for string values) */}
                  {(() => {
                    const outputValue = step.output_data.content || step.output_data.result;
                    // Only render if it's a non-empty string (not array/object)
                    if (typeof outputValue === 'string' && outputValue.length > 0 && !step.output_data.optimized_queries && !step.output_data.urls) {
                      return (
                        <div className="mb-3">
                          <p className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap">
                            {outputValue.substring(0, 1000)}
                            {outputValue.length > 1000 && '...'}
                          </p>
                        </div>
                      );
                    }
                    // For arrays/objects, show a summary
                    if (Array.isArray(outputValue) && !step.output_data.optimized_queries && !step.output_data.urls) {
                      return (
                        <div className="mb-3">
                          <p className="text-sm text-green-800 dark:text-green-200">
                            {outputValue.length === 0 ? 'Empty result (no items)' : `${outputValue.length} items processed`}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Full output details */}
                  <details>
                    <summary className="cursor-pointer text-xs text-green-600 dark:text-green-400 hover:underline">
                      View full output JSON
                    </summary>
                    <pre className="mt-2 p-2 bg-green-100 dark:bg-green-900/40 rounded text-xs overflow-x-auto max-h-64 text-green-800 dark:text-green-200">
                      {typeof step.output_data === 'string' 
                        ? step.output_data 
                        : JSON.stringify(step.output_data, null, 2)}
                    </pre>
                  </details>
                </div>
              )}

              {/* Step Error */}
              {step.error && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                  <p className="text-sm text-red-600 dark:text-red-300">{step.error}</p>
                </div>
              )}
            </div>
          ))}

          {/* Show "waiting for steps" if execution is running but no steps yet */}
          {(execution.status === 'pending' || execution.status === 'running') && steps.length === 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-3"></div>
              <p className="text-blue-800 dark:text-blue-200">Workflow is starting...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
