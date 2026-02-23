'use client';

import React, { useEffect, useState } from 'react';

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
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

interface RunsListProps {
  agentId: string;
  token?: string;
  onSelectRun?: (run: Run) => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: '⏳' },
  running: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: '🔄' },
  succeeded: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: '✅' },
  failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: '❌' },
  timeout: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', icon: '⏰' },
};

export function RunsList({ agentId, token, onSelectRun }: RunsListProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchRuns() {
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
        const res = await fetch(`/api/runs?agent_id=${agentId}${statusParam}`, {
          headers,
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load runs');
        // Handle both array and paginated response
        setRuns(Array.isArray(data) ? data : data.items || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load runs');
      } finally {
        setLoading(false);
      }
    }
    if (agentId) fetchRuns();
  }, [agentId, statusFilter, token]);

  const handleSelect = (run: Run) => {
    setSelectedId(run.id);
    onSelectRun?.(run);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getInputPreview = (input: Record<string, any>) => {
    const prompt = input.prompt || input.message || input.query || JSON.stringify(input);
    return typeof prompt === 'string' ? prompt.slice(0, 100) : String(prompt).slice(0, 100);
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
      if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
      return `${(durationMs / 60000).toFixed(1)}m`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading runs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">Filter by status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="all">All</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
          <option value="pending">Pending</option>
          <option value="timeout">Timeout</option>
        </select>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">🚀</div>
          <p>No API runs found for this agent.</p>
          <p className="text-sm mt-1">Runs will appear here when the agent is executed via the API.</p>
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {runs.length} run{runs.length !== 1 ? 's' : ''} found
          </div>
          <div className="space-y-2">
            {runs.map((run) => {
              const styles = STATUS_STYLES[run.status] || STATUS_STYLES.pending;
              const duration = getDuration(run);
              
              return (
                <button
                  key={run.id}
                  onClick={() => handleSelect(run)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedId === run.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles.bg} ${styles.text}`}>
                          <span className="mr-1">{styles.icon}</span>
                          {run.status}
                        </span>
                        {duration && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {duration}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 truncate font-mono">
                        {getInputPreview(run.input)}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono">{run.id.slice(0, 8)}...</span>
                        <span>{run.events.length} event{run.events.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="ml-4 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(run.created_at)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
