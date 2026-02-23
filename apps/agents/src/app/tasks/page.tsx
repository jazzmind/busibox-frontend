'use client';

/**
 * Tasks List Page
 * Displays all agent tasks for the current user with filtering and actions.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@jazzmind/busibox-app';
import { formatDateTime, formatDate } from '@jazzmind/busibox-app/lib/date-utils';

interface Task {
  id: string;
  name: string;
  description?: string;
  agent_id: string;
  prompt: string;
  trigger_type: string;
  trigger_config: {
    cron?: string;
    run_at?: string;
  };
  notification_config: {
    enabled?: boolean;
    channel?: string;
    recipient?: string;
  };
  status: string;
  last_run_at?: string;
  next_run_at?: string;
  run_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
}

const getTriggerIcon = (type: string) => {
  switch (type) {
    case 'cron': return '⏰';
    case 'webhook': return '🔗';
    case 'one_time': return '📅';
    default: return '❓';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'expired': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getNotificationIcon = (channel: string) => {
  switch (channel) {
    case 'email': return '📧';
    case 'teams': return '💬';
    case 'slack': return '💬';
    case 'webhook': return '🔗';
    default: return '🔔';
  }
};

const formatCron = (cron: string): string => {
  // Simple cron to human-readable conversion
  const presets: Record<string, string> = {
    '0 * * * *': 'Hourly',
    '0 */2 * * *': 'Every 2 hours',
    '0 */6 * * *': 'Every 6 hours',
    '0 9 * * *': 'Daily at 9 AM',
    '0 18 * * *': 'Daily at 6 PM',
    '0 9 * * 1': 'Weekly (Monday)',
    '0 9 1 * *': 'Monthly',
  };
  return presets[cron] || cron;
};

export default function TasksListPage() {
  const { isReady, refreshKey } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [triggerFilter, setTriggerFilter] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    loadTasks();
  }, [isReady, refreshKey, statusFilter, triggerFilter]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (triggerFilter) params.append('trigger_type', triggerFilter);
      
      const response = await fetch(`/api/tasks?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}/pause`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to pause task');
      await loadTasks();
    } catch (err) {
      alert(`Failed to pause task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}/resume`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to resume task');
      await loadTasks();
    } catch (err) {
      alert(`Failed to resume task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRun = async (taskId: string) => {
    setActionLoading(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to run task');
      const result = await response.json();
      alert(`Task execution started! Execution ID: ${result.execution_id}`);
      await loadTasks();
    } catch (err) {
      alert(`Failed to run task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (taskId: string, taskName: string) => {
    if (!confirm(`Delete task "${taskName}"? This cannot be undone.`)) return;

    setActionLoading(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete task');
      await loadTasks();
    } catch (err) {
      alert(`Failed to delete task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
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

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Error Loading Tasks</h3>
          <p className="text-red-600 dark:text-red-300">{error}</p>
          <button
            onClick={loadTasks}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Agent Tasks</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Scheduled and event-driven agent executions
          </p>
        </div>
        <Link
          href="/tasks/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Create Task
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={triggerFilter}
          onChange={(e) => setTriggerFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">All Triggers</option>
          <option value="cron">Scheduled (Cron)</option>
          <option value="webhook">Webhook</option>
          <option value="one_time">One-time</option>
        </select>
      </div>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Tasks Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first task to automate agent executions.
          </p>
          <Link
            href="/tasks/new"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Create Your First Task
          </Link>
        </div>
      )}

      {/* Task Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow"
          >
            {/* Header */}
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {task.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {task.description || task.prompt.substring(0, 100) + '...'}
              </p>
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                {task.status}
              </span>
              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                {getTriggerIcon(task.trigger_type)} {task.trigger_type}
              </span>
              {task.notification_config?.enabled && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  {getNotificationIcon(task.notification_config.channel || 'email')} Notifications
                </span>
              )}
            </div>

            {/* Schedule Info */}
            {task.trigger_type === 'cron' && task.trigger_config.cron && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Schedule:</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatCron(task.trigger_config.cron)}
                </p>
                {task.next_run_at && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Next run: {formatDateTime(task.next_run_at)}
                  </p>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="mb-4 flex gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>{task.run_count} runs</span>
              {task.error_count > 0 && (
                <span className="text-red-600 dark:text-red-400">{task.error_count} errors</span>
              )}
              {task.last_run_at && (
                <span>Last: {formatDate(task.last_run_at)}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/tasks/${task.id}`}
                className="flex-1 px-3 py-2 text-sm text-center bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                View
              </Link>
              {task.status === 'active' ? (
                <>
                  <button
                    onClick={() => handleRun(task.id)}
                    disabled={actionLoading === task.id}
                    className="px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                  >
                    Run
                  </button>
                  <button
                    onClick={() => handlePause(task.id)}
                    disabled={actionLoading === task.id}
                    className="px-3 py-2 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors disabled:opacity-50"
                  >
                    Pause
                  </button>
                </>
              ) : task.status === 'paused' ? (
                <button
                  onClick={() => handleResume(task.id)}
                  disabled={actionLoading === task.id}
                  className="px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                >
                  Resume
                </button>
              ) : null}
              <button
                onClick={() => handleDelete(task.id, task.name)}
                disabled={actionLoading === task.id}
                className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
