'use client';

import React, { useEffect, useState } from 'react';
import { EventTimeline } from './EventTimeline';

interface RunEvent {
  timestamp: string;
  type: string;
  data?: Record<string, any>;
  error?: string;
}

interface Run {
  id: string;
  agent_id: string;
  workflow_id?: string | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'timeout';
  input: Record<string, any>;
  output?: Record<string, any> | null;
  events: RunEvent[];
  definition_snapshot?: Record<string, any> | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

interface RunDetailPanelProps {
  runId: string;
  token?: string;
  onClose?: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: '⏳' },
  running: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: '🔄' },
  succeeded: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: '✅' },
  failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: '❌' },
  timeout: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', icon: '⏰' },
};

export function RunDetailPanel({ runId, token, onClose }: RunDetailPanelProps) {
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'input' | 'output' | 'events' | 'snapshot'>('overview');

  useEffect(() => {
    async function fetchRun() {
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`/api/runs/${runId}`, {
          headers,
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load run details');
        setRun(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load run details');
      } finally {
        setLoading(false);
      }
    }
    if (runId) fetchRun();
  }, [runId, token]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getDuration = (run: Run) => {
    const startEvent = run.events.find(e => e.type === 'execution_started');
    const endEvent = run.events.find(e => 
      e.type === 'execution_completed' || e.type === 'execution_failed' || e.type === 'timeout'
    );
    
    if (startEvent && endEvent) {
      const start = new Date(startEvent.timestamp).getTime();
      const end = new Date(endEvent.timestamp).getTime();
      const durationMs = end - start;
      
      if (durationMs < 1000) return `${durationMs}ms`;
      if (durationMs < 60000) return `${(durationMs / 1000).toFixed(2)}s`;
      return `${(durationMs / 60000).toFixed(2)}m`;
    }
    return 'N/A';
  };

  const getTokenUsage = (run: Run) => {
    // Look for token usage in output or events
    if (run.output?.token_usage) {
      return run.output.token_usage;
    }
    // Check events for usage data
    for (const event of run.events) {
      if (event.data?.token_usage) {
        return event.data.token_usage;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading run details...</span>
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error || 'Run not found'}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Back
          </button>
        )}
      </div>
    );
  }

  const styles = STATUS_STYLES[run.status] || STATUS_STYLES.pending;
  const tokenUsage = getTokenUsage(run);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ←
              </button>
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Run Details
            </h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles.bg} ${styles.text}`}>
              <span className="mr-1">{styles.icon}</span>
              {run.status}
            </span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
            {run.id}
          </span>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4">
        <nav className="flex space-x-6">
          {(['overview', 'input', 'output', 'events', 'snapshot'] as const).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSection === section
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {section.charAt(0).toUpperCase() + section.slice(1)}
              {section === 'events' && ` (${run.events.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {activeSection === 'overview' && (
          <div className="space-y-4">
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Duration</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {getDuration(run)}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Events</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {run.events.length}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Created</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                  {formatDate(run.created_at)}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Agent ID</div>
                <div className="text-sm font-mono text-gray-900 dark:text-gray-100 mt-1 truncate">
                  {run.agent_id}
                </div>
              </div>
            </div>

            {/* Token Usage */}
            {tokenUsage && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Token Usage</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Input</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {tokenUsage.prompt_tokens || tokenUsage.input_tokens || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Output</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {tokenUsage.completion_tokens || tokenUsage.output_tokens || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {tokenUsage.total_tokens || 0}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {run.status === 'failed' && run.output?.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Error</h4>
                <pre className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap font-mono">
                  {run.output.error}
                </pre>
                {run.output.error_type && (
                  <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                    Type: {run.output.error_type}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSection === 'input' && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono overflow-x-auto">
              {JSON.stringify(run.input, null, 2)}
            </pre>
          </div>
        )}

        {activeSection === 'output' && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            {run.output ? (
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono overflow-x-auto">
                {JSON.stringify(run.output, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 italic">No output available</p>
            )}
          </div>
        )}

        {activeSection === 'events' && (
          <EventTimeline events={run.events} />
        )}

        {activeSection === 'snapshot' && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            {run.definition_snapshot ? (
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono overflow-x-auto">
                {JSON.stringify(run.definition_snapshot, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 italic">No definition snapshot available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
