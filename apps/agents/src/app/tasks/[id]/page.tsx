'use client';

/**
 * Task Detail Page
 * Shows task details, execution history, and insights.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@jazzmind/busibox-app';
import { formatDateTime, formatDate, formatTime } from '@jazzmind/busibox-app/lib/date-utils';
import { useExecutionStream } from '@/hooks/useExecutionStream';

interface Agent {
  id: string;
  name: string;
  display_name: string;
  description?: string;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  is_builtin?: boolean;
}

interface NotificationChannelConfig {
  channel: string;
  recipient: string;
  enabled?: boolean;
}

interface Task {
  id: string;
  name: string;
  description?: string;
  agent_id?: string;
  workflow_id?: string;
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
    channels?: NotificationChannelConfig[];
    include_summary?: boolean;
    on_success?: boolean;
    on_failure?: boolean;
  };
  insights_config: {
    enabled?: boolean;
    max_insights?: number;
    purge_after_days?: number;
  };
  output_saving_config?: {
    enabled?: boolean;
    library_type?: string;
    tags?: string[];
    title_template?: string;
    on_success_only?: boolean;
  };
  delegation_scopes: string[];
  delegation_expires_at?: string;
  status: string;
  last_run_at?: string;
  last_run_id?: string;
  next_run_at?: string;
  run_count: number;
  error_count: number;
  last_error?: string;
  webhook_url?: string;
  created_at: string;
  updated_at: string;
}

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
}

interface RunRecord {
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
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface TaskNotification {
  id: string;
  execution_id: string;
  channel: string;
  recipient: string;
  subject: string;
  status: string;
  message_id?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  error?: string;
  retry_count: number;
  created_at: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'succeeded': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    case 'stopped': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'timeout': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getTriggerIcon = (type: string) => {
  switch (type) {
    case 'cron': return '⏰';
    case 'webhook': return '🔗';
    case 'manual': return '👆';
    default: return '📅';
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
    case 'timeout': return '⏱️';
    case 'error': return '❌';
    case 'setup_failed': return '⚠️';
    default: return '📍';
  }
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const { isReady } = useAuth();
  
  const [task, setTask] = useState<Task | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<Record<string, RunRecord>>({});
  const [loadingRun, setLoadingRun] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'executions' | 'notifications' | 'insights'>('executions');
  const [insights, setInsights] = useState<{id: string; content: string; createdAt: string; executionId?: string}[]>([]);
  const [insightsCount, setInsightsCount] = useState(0);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [executionCompleted, setExecutionCompleted] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  // SSE streaming for live workflow execution progress
  const executionStream = useExecutionStream(activeExecutionId, {
    onComplete: useCallback(() => {
      setExecutionCompleted(true);
    }, []),
    onError: useCallback((errMsg: string) => {
      console.error('Execution stream error:', errMsg);
    }, []),
  });

  useEffect(() => {
    if (!isReady) return;
    loadTask();
    loadExecutions();
    loadAgents();
    loadWorkflows();
    loadNotifications();
    loadInsights();
  }, [isReady, taskId]);

  // When execution completes via SSE, refresh the data
  useEffect(() => {
    if (executionCompleted) {
      loadTask();
      loadExecutions();
      setExecutionCompleted(false);
    }
  }, [executionCompleted]);

  const loadTask = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) throw new Error('Failed to load task');
      const data = await response.json();
      setTask(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const loadExecutions = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/executions?limit=20`);
      if (!response.ok) return;
      const data: TaskExecution[] = await response.json();
      setExecutions(data);
      
      // Auto-reconnect SSE if there's a running workflow execution
      // (handles page refresh / navigating away and back)
      if (!activeExecutionId) {
        const runningExec = data.find(
          (exec: TaskExecution) => 
            (exec.status === 'running' || exec.status === 'pending') &&
            exec.output_data?.workflow_execution_id  // Only reconnect for workflow executions with SSE support
        );
        if (runningExec) {
          setActiveExecutionId(runningExec.id);
          setActiveTab('executions');
        }
      }
    } catch (err) {
      console.error('Failed to load executions:', err);
    }
  };

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      if (!response.ok) return;
      const data = await response.json();
      setAgents(data);
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  };

  const loadWorkflows = async () => {
    try {
      const response = await fetch('/api/workflows');
      if (!response.ok) return;
      const data = await response.json();
      setWorkflows(data);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/notifications?limit=50`);
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const loadInsights = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/insights?limit=50`);
      if (!response.ok) return;
      const data = await response.json();
      setInsights(data.insights || []);
      setInsightsCount(data.count || 0);
    } catch (err) {
      console.error('Failed to load insights:', err);
    }
  };

  const loadRunDetails = async (runId: string) => {
    if (runDetails[runId]) return; // Already loaded
    
    setLoadingRun(runId);
    try {
      const response = await fetch(`/api/runs/${runId}`);
      if (!response.ok) {
        console.error('Failed to load run details');
        return;
      }
      const data = await response.json();
      setRunDetails(prev => ({ ...prev, [runId]: data }));
    } catch (err) {
      console.error('Failed to load run details:', err);
    } finally {
      setLoadingRun(null);
    }
  };

  const toggleExecution = async (execId: string, runId?: string) => {
    if (expandedExecution === execId) {
      setExpandedExecution(null);
    } else {
      setExpandedExecution(execId);
      if (runId) {
        await loadRunDetails(runId);
      }
    }
  };

  const getAgentName = (agentId?: string): string => {
    if (!agentId) return 'Unknown';
    const agent = agents.find(a => a.id === agentId);
    return agent?.display_name || agent?.name || agentId;
  };

  const getWorkflowName = (workflowId?: string): string => {
    if (!workflowId) return 'Unknown';
    const workflow = workflows.find(w => w.id === workflowId);
    return workflow?.name || workflowId;
  };

  const getTargetName = (): { type: 'agent' | 'workflow'; name: string } => {
    if (task?.workflow_id) {
      return { type: 'workflow', name: getWorkflowName(task.workflow_id) };
    }
    return { type: 'agent', name: getAgentName(task?.agent_id) };
  };

  const handlePause = async () => {
    setActionLoading('pause');
    try {
      const response = await fetch(`/api/tasks/${taskId}/pause`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to pause task');
      await loadTask();
    } catch (err) {
      alert(`Failed to pause task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    setActionLoading('resume');
    try {
      const response = await fetch(`/api/tasks/${taskId}/resume`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to resume task');
      await loadTask();
    } catch (err) {
      alert(`Failed to resume task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRun = async () => {
    setActionLoading('run');
    try {
      const response = await fetch(`/api/tasks/${taskId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to run task');
      const result = await response.json();
      
      // For workflow executions, connect to SSE for live progress
      if (result.execution_id && task?.workflow_id) {
        setActiveExecutionId(result.execution_id);
        // Switch to executions tab to show progress
        setActiveTab('executions');
      } else {
        // For agent-only tasks, just refresh
        await loadTask();
        await loadExecutions();
      }
    } catch (err) {
      alert(`Failed to run task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm(`Delete task "${task.name}"? This cannot be undone.`)) return;

    setActionLoading('delete');
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete task');
      router.push('/tasks');
    } catch (err) {
      alert(`Failed to delete task: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setActionLoading(null);
    }
  };

  const handleRefreshDelegation = async () => {
    setActionLoading('refresh-token');
    try {
      const response = await fetch(`/api/tasks/${taskId}/refresh-token`, { method: 'POST' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || 'Failed to refresh token');
      }
      await loadTask();
      alert('Delegation token refreshed successfully. New expiry: 3 years.');
    } catch (err) {
      alert(`Failed to refresh token: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopExecution = async (executionId: string) => {
    if (!confirm('Stop this execution? The current step will complete before the workflow halts.')) return;
    
    try {
      const response = await fetch(`/api/tasks/${taskId}/executions/${executionId}/stop`, {
        method: 'POST',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || err.error || 'Failed to stop execution');
      }
      // Refresh data and clear SSE stream if this was the active one
      if (activeExecutionId === executionId) {
        executionStream.disconnect();
        setActiveExecutionId(null);
      }
      await loadExecutions();
      await loadTask();
    } catch (err) {
      alert(`Failed to stop execution: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteExecution = async (executionId: string) => {
    if (!confirm('Delete this execution record? This cannot be undone.')) return;
    
    try {
      const response = await fetch(`/api/tasks/${taskId}/executions/${executionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || err.error || 'Failed to delete execution');
      }
      // Refresh list
      await loadExecutions();
      await loadTask();
    } catch (err) {
      alert(`Failed to delete execution: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteFailedExecutions = async () => {
    const failedExecutions = executions.filter((exec) => exec.status === 'failed');
    if (failedExecutions.length === 0) return;

    const confirmed = confirm(
      `Delete all ${failedExecutions.length} failed execution record(s)? This cannot be undone.`
    );
    if (!confirmed) return;

    setActionLoading('delete-failed-executions');
    try {
      const failures: string[] = [];
      for (const exec of failedExecutions) {
        const response = await fetch(`/api/tasks/${taskId}/executions/${exec.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
          failures.push(`${exec.id.slice(0, 8)}: ${err.detail || err.error || response.statusText}`);
        }
      }

      await loadExecutions();
      await loadTask();

      if (failures.length > 0) {
        alert(
          `Deleted ${failedExecutions.length - failures.length}/${failedExecutions.length} failed execution(s).\n\n` +
            `Some deletions failed:\n${failures.join('\n')}`
        );
      }
    } catch (err) {
      alert(
        `Failed to bulk delete failed executions: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Helper to get notification channels from config
  const getNotificationChannels = (): NotificationChannelConfig[] => {
    if (!task?.notification_config?.enabled) return [];
    
    // Check for new multi-channel format
    if (task.notification_config.channels && task.notification_config.channels.length > 0) {
      return task.notification_config.channels.filter(ch => ch.enabled !== false);
    }
    
    // Fallback to legacy single-channel format
    if (task.notification_config.recipient) {
      return [{
        channel: task.notification_config.channel || 'email',
        recipient: task.notification_config.recipient,
        enabled: true,
      }];
    }
    
    return [];
  };

  // Helper to check if delegation token is expired or expiring soon
  const getDelegationTokenStatus = (): { status: 'ok' | 'expiring' | 'expired'; text: string; color: string } => {
    if (!task?.delegation_expires_at) {
      return { status: 'expired', text: 'Not set', color: 'text-gray-500 dark:text-gray-400' };
    }
    
    const expiresAt = new Date(task.delegation_expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { status: 'expired', text: 'Expired', color: 'text-red-600 dark:text-red-400' };
    } else if (daysUntilExpiry < 30) {
      return { status: 'expiring', text: `Expires in ${daysUntilExpiry} days`, color: 'text-yellow-600 dark:text-yellow-400' };
    } else if (daysUntilExpiry < 365) {
      return { status: 'ok', text: `Expires in ${Math.floor(daysUntilExpiry / 30)} months`, color: 'text-green-600 dark:text-green-400' };
    } else {
      return { status: 'ok', text: `Expires in ${Math.floor(daysUntilExpiry / 365)} years`, color: 'text-green-600 dark:text-green-400' };
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Error</h3>
          <p className="text-red-600 dark:text-red-300">{error || 'Task not found'}</p>
          <Link
            href="/tasks"
            className="mt-4 inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Back to Tasks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link
              href="/tasks"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              ← Back to Tasks
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{task.name}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {task.description || 'No description'}
          </p>
        </div>
        <div className="flex gap-2">
          {task.status === 'active' ? (
            <>
              <button
                onClick={handleRun}
                disabled={!!actionLoading || !!activeExecutionId}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading === 'run' ? 'Starting...' : activeExecutionId ? 'Running...' : 'Run Now'}
              </button>
              <button
                onClick={handlePause}
                disabled={!!actionLoading}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Pause
              </button>
            </>
          ) : task.status === 'paused' ? (
            <button
              onClick={handleResume}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Resume
            </button>
          ) : null}
          <Link
            href={`/tasks/${task.id}/edit`}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={!!actionLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Status Badge and Agent/Workflow */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.status)}`}>
          {task.status}
        </span>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          {getTriggerIcon(task.trigger_type)} {task.trigger_type}
        </span>
        {(() => {
          const target = getTargetName();
          return (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              target.type === 'workflow' 
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
            }`}>
              {target.type === 'workflow' ? '📋' : '🤖'} {target.name}
            </span>
          );
        })()}
      </div>

      {/* Task Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Configuration */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Prompt</label>
              <p className="text-gray-900 dark:text-gray-100 mt-1 bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                {task.prompt}
              </p>
            </div>

            {task.trigger_type === 'cron' && task.trigger_config.cron && (
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Schedule</label>
                <p className="text-gray-900 dark:text-gray-100 mt-1 font-mono">
                  {task.trigger_config.cron}
                </p>
              </div>
            )}

            {task.next_run_at && (
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Next Run</label>
                <p className="text-gray-900 dark:text-gray-100 mt-1">
                  {formatDateTime(task.next_run_at)}
                </p>
              </div>
            )}

            {task.trigger_type === 'webhook' && task.webhook_url && (
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Webhook URL</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                    {task.webhook_url}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(task.webhook_url!)}
                    className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Delegation Token */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <label className="text-sm text-gray-600 dark:text-gray-400">Delegation Token</label>
              <div className="flex items-center justify-between mt-1">
                <div>
                  <span className={`text-sm font-medium ${getDelegationTokenStatus().color}`}>
                    {getDelegationTokenStatus().text}
                  </span>
                  {task.delegation_expires_at && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Expires: {formatDate(task.delegation_expires_at)}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleRefreshDelegation}
                  disabled={!!actionLoading}
                  className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'refresh-token' ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Notification Channels */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <label className="text-sm text-gray-600 dark:text-gray-400">Notifications</label>
              {!task.notification_config?.enabled ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Disabled</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {getNotificationChannels().length === 0 ? (
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">Enabled but no channels configured</p>
                  ) : (
                    getNotificationChannels().map((ch, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {ch.channel === 'email'
                            ? '📧 email'
                            : ch.channel === 'teams'
                              ? '💬 teams'
                              : ch.channel === 'slack'
                                ? '💬 slack'
                                : ch.channel === 'webhook'
                                  ? '🔗 webhook'
                                  : ch.channel === 'bridge_telegram'
                                    ? '✈️ bridge telegram'
                                    : ch.channel === 'bridge_signal'
                                      ? '🔐 bridge signal'
                                      : ch.channel === 'bridge_discord'
                                        ? '🎮 bridge discord'
                                        : ch.channel === 'bridge_whatsapp'
                                          ? '💬 bridge whatsapp'
                                          : `🔔 ${ch.channel}`}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title={ch.recipient}>
                          {ch.recipient.length > 30 ? ch.recipient.slice(0, 30) + '...' : ch.recipient}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Output Saving */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <label className="text-sm text-gray-600 dark:text-gray-400">Save Output to Library</label>
              {!task.output_saving_config?.enabled ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Disabled</p>
              ) : (
                <div className="mt-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                      Enabled
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      → {task.output_saving_config.library_type || 'TASKS'} library
                    </span>
                  </div>
                  {task.output_saving_config.tags && task.output_saving_config.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {task.output_saving_config.tags.map((tag, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Statistics</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Total Runs</label>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{task.run_count}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Errors</label>
              <p className={`text-2xl font-bold ${task.error_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                {task.error_count}
              </p>
            </div>
            {task.last_run_at && (
              <div className="col-span-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Last Run</label>
                <p className="text-gray-900 dark:text-gray-100">
                  {formatDateTime(task.last_run_at)}
                </p>
              </div>
            )}
          </div>

          {task.last_error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <label className="text-sm text-red-600 dark:text-red-400">Last Error</label>
              <p className="text-red-800 dark:text-red-200 text-sm mt-1 whitespace-pre-wrap">{task.last_error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs for Executions and Notifications */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('executions')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'executions'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Execution History ({executions.length})
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'notifications'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Notifications ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'insights'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Insights ({insightsCount})
          </button>
        </div>

        <div className="p-6">
        {/* Execution History Tab */}
        {activeTab === 'executions' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage recent task runs and clean up failed records.
              </p>
              <button
                onClick={handleDeleteFailedExecutions}
                disabled={!!actionLoading || executions.filter((exec) => exec.status === 'failed').length === 0}
                className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {actionLoading === 'delete-failed-executions'
                  ? 'Deleting failed...'
                  : `Delete Failed (${executions.filter((exec) => exec.status === 'failed').length})`}
              </button>
            </div>

            {/* Live Execution Progress Panel */}
            {activeExecutionId && (
              <div className="mb-6 border border-blue-300 dark:border-blue-700 rounded-lg overflow-hidden bg-blue-50 dark:bg-blue-900/20">
                <div className="px-4 py-3 bg-blue-100 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-3 w-3">
                      {executionStream.isRunning && (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </>
                      )}
                      {!executionStream.isRunning && executionStream.result && (
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${
                          executionStream.result.status === 'completed' || executionStream.result.status === 'succeeded'
                            ? 'bg-green-500' : 'bg-red-500'
                        }`}></span>
                      )}
                    </div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                      {executionStream.isRunning ? 'Workflow Running...' : 
                       executionStream.result?.status === 'completed' || executionStream.result?.status === 'succeeded' 
                         ? 'Workflow Completed' : executionStream.result ? 'Workflow Failed' : 'Connecting...'}
                    </h3>
                    {executionStream.status && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(executionStream.status)}`}>
                        {executionStream.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {executionStream.isRunning && activeExecutionId && (
                      <button
                        onClick={() => handleStopExecution(activeExecutionId)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                      >
                        Stop
                      </button>
                    )}
                    {!executionStream.isRunning && (
                      <button
                        onClick={() => setActiveExecutionId(null)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Step Progress */}
                <div className="p-4">
                  {executionStream.steps.length === 0 && executionStream.isRunning && (
                    <div className="flex items-center gap-3 text-blue-700 dark:text-blue-300">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                      <span className="text-sm">Initializing workflow...</span>
                    </div>
                  )}
                  
                  {executionStream.steps.length > 0 && (
                    <div className="space-y-2">
                      {/* Progress bar */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              executionStream.result?.status === 'failed' ? 'bg-red-500' : 'bg-blue-600 dark:bg-blue-400'
                            }`}
                            style={{
                              width: `${Math.max(
                                5,
                                (executionStream.steps.filter(s => s.status === 'completed' || s.status === 'succeeded').length /
                                  Math.max(executionStream.steps[0]?.total_steps || executionStream.steps.length, 1)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap">
                          {executionStream.steps.filter(s => s.status === 'completed' || s.status === 'succeeded').length}
                          /{executionStream.steps[0]?.total_steps || executionStream.steps.length} steps
                        </span>
                      </div>
                      
                      {/* Step list */}
                      <div className="space-y-1.5">
                        {executionStream.steps.map((step, idx) => (
                          <div key={step.step_id}>
                            <div 
                              className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                                step.status === 'running'
                                  ? 'bg-blue-100 dark:bg-blue-800/40 border border-blue-300 dark:border-blue-700'
                                  : step.status === 'completed' || step.status === 'succeeded'
                                  ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40'
                                  : step.status === 'failed'
                                  ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40'
                                  : 'bg-gray-50 dark:bg-gray-800'
                              } ${(step.output_data || step.error) ? 'cursor-pointer' : ''}`}
                              onClick={() => {
                                if (step.output_data || step.error) {
                                  setExpandedStepId(expandedStepId === step.step_id ? null : step.step_id);
                                }
                              }}
                            >
                              {/* Step icon */}
                              <span className="flex-shrink-0 w-5 text-center">
                                {step.status === 'running' && (
                                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></span>
                                )}
                                {(step.status === 'completed' || step.status === 'succeeded') && (
                                  <span className="text-green-600 dark:text-green-400">&#10003;</span>
                                )}
                                {step.status === 'failed' && (
                                  <span className="text-red-600 dark:text-red-400">&#10007;</span>
                                )}
                                {step.status === 'pending' && (
                                  <span className="text-gray-400">&#9675;</span>
                                )}
                              </span>
                              
                              {/* Step name */}
                              <span className={`flex-1 ${
                                step.status === 'running' ? 'text-blue-800 dark:text-blue-200 font-medium' :
                                step.status === 'completed' || step.status === 'succeeded' ? 'text-green-800 dark:text-green-200' :
                                step.status === 'failed' ? 'text-red-800 dark:text-red-200' :
                                'text-gray-600 dark:text-gray-400'
                              }`}>
                                {step.step_id.replace(/_/g, ' ').replace(/-/g, ' ')}
                              </span>
                              
                              {/* Duration */}
                              {step.duration_seconds != null && (
                                <span className="text-gray-500 dark:text-gray-400 text-xs">
                                  {step.duration_seconds.toFixed(1)}s
                                </span>
                              )}
                              
                              {/* Expand indicator */}
                              {(step.output_data || step.error) && (
                                <span className="text-gray-400 dark:text-gray-500 text-xs flex-shrink-0">
                                  {expandedStepId === step.step_id ? '▼' : '▶'}
                                </span>
                              )}
                            </div>
                            
                            {/* Expanded step output */}
                            {expandedStepId === step.step_id && (step.output_data || step.error) && (
                              <div className="ml-8 mt-1 mb-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden">
                                {step.error && (
                                  <div className="px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs border-b border-red-200 dark:border-red-800">
                                    <span className="font-medium">Error: </span>{step.error}
                                  </div>
                                )}
                                {step.output_data && (
                                  <pre className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono">
                                    {JSON.stringify(step.output_data, null, 2)}
                                  </pre>
                                )}
                                {step.usage_input_tokens != null && (
                                  <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex gap-3">
                                    {step.usage_requests != null && <span>Requests: {step.usage_requests}</span>}
                                    <span>Input: {step.usage_input_tokens?.toLocaleString()} tokens</span>
                                    {step.usage_output_tokens != null && <span>Output: {step.usage_output_tokens?.toLocaleString()} tokens</span>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Completion summary */}
                  {executionStream.result && (
                    <div className={`mt-3 p-3 rounded text-sm ${
                      executionStream.result.status === 'completed' || executionStream.result.status === 'succeeded'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {executionStream.result.status === 'completed' || executionStream.result.status === 'succeeded'
                            ? 'Workflow completed successfully'
                            : `Workflow failed: ${executionStream.result.error || 'Unknown error'}`}
                        </span>
                        {executionStream.result.duration_seconds != null && (
                          <span className="text-xs opacity-75">
                            Total: {executionStream.result.duration_seconds.toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Error from stream */}
                  {executionStream.error && !executionStream.result && (
                    <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded text-sm">
                      Stream error: {executionStream.error}
                    </div>
                  )}
                </div>
              </div>
            )}

            {executions.length === 0 && !activeExecutionId ? (
          <p className="text-gray-500 dark:text-gray-400">No executions yet. Click "Run Now" to trigger the first execution.</p>
        ) : (
          <div className="space-y-2">
            {executions.map((exec) => (
              <div key={exec.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Execution Summary Row */}
                <button
                  onClick={() => toggleExecution(exec.id, exec.run_id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-gray-900 dark:text-gray-100 text-sm">
                      {formatDateTime(exec.created_at)}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">
                      {getTriggerIcon(exec.trigger_source)} {exec.trigger_source}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(exec.status)}`}>
                      {exec.status}
                    </span>
                    {exec.duration_seconds && (
                      <span className="text-gray-500 dark:text-gray-400 text-sm">
                        {exec.duration_seconds.toFixed(1)}s
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(exec.status === 'running' || exec.status === 'pending') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStopExecution(exec.id); }}
                        className="px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 text-xs font-medium rounded transition-colors"
                        title="Stop execution"
                      >
                        Stop
                      </button>
                    )}
                    {['failed', 'stopped', 'timeout'].includes(exec.status) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteExecution(exec.id); }}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-medium rounded transition-colors"
                        title="Delete execution"
                      >
                        Delete
                      </button>
                    )}
                    <span className="text-gray-400">
                      {expandedExecution === exec.id ? '▲' : '▼'}
                    </span>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedExecution === exec.id && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
                    {/* Action Buttons */}
                    <div className="mb-4 flex items-center gap-2">
                      <Link
                        href={`/tasks/${task.id}/executions/${exec.id}`}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        View Full Details →
                      </Link>
                      {(exec.status === 'running' || exec.status === 'pending') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStopExecution(exec.id); }}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Stop Execution
                        </button>
                      )}
                      {['failed', 'stopped', 'timeout', 'completed', 'succeeded'].includes(exec.status) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteExecution(exec.id); }}
                          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    {/* Execution Error */}
                    {exec.error && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
                        <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">Error</h4>
                        <pre className="text-red-700 dark:text-red-300 text-sm whitespace-pre-wrap overflow-x-auto">
                          {exec.error}
                        </pre>
                      </div>
                    )}

                    {/* Input Data */}
                    {exec.input_data && Object.keys(exec.input_data).length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Input</h4>
                        <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
                          {JSON.stringify(exec.input_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Output Summary */}
                    {exec.output_summary && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Output Summary</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded line-clamp-6">
                          {exec.output_summary}
                        </p>
                      </div>
                    )}

                    {/* Run Details (if run_id exists) */}
                    {exec.run_id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Agent Run Details
                          {loadingRun === exec.run_id && (
                            <span className="ml-2 text-gray-400 font-normal">Loading...</span>
                          )}
                        </h4>
                        
                        {runDetails[exec.run_id] ? (
                          <div className="space-y-4">
                            {/* Run Status */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Run Status:</span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(runDetails[exec.run_id].status)}`}>
                                {runDetails[exec.run_id].status}
                              </span>
                            </div>

                            {/* Run Input */}
                            <div>
                              <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Run Input</h5>
                              <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto max-h-48 overflow-y-auto">
                                {JSON.stringify(runDetails[exec.run_id].input, null, 2)}
                              </pre>
                            </div>

                            {/* Run Output */}
                            {runDetails[exec.run_id].output && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Run Output</h5>
                                <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
                                  {JSON.stringify(runDetails[exec.run_id].output, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Run Events Timeline */}
                            {runDetails[exec.run_id].events && runDetails[exec.run_id].events.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Event Timeline</h5>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {runDetails[exec.run_id].events.map((event, idx) => (
                                    <div 
                                      key={idx}
                                      className={`p-2 rounded text-sm ${
                                        event.type.includes('error') || event.type.includes('failed')
                                          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                                          : event.type.includes('completed') || event.type.includes('succeeded')
                                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                          : 'bg-gray-100 dark:bg-gray-800'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span>{getEventIcon(event.type)}</span>
                                        <span className="font-medium text-gray-800 dark:text-gray-200">
                                          {event.type.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-gray-500 dark:text-gray-400 text-xs">
                                          {formatTime(event.timestamp)}
                                        </span>
                                      </div>
                                      {event.error && (
                                        <pre className="mt-1 text-red-600 dark:text-red-400 text-xs whitespace-pre-wrap">
                                          {event.error}
                                        </pre>
                                      )}
                                      {event.data && Object.keys(event.data).length > 0 && (
                                        <pre className="mt-1 text-gray-600 dark:text-gray-400 text-xs whitespace-pre-wrap">
                                          {JSON.stringify(event.data, null, 2)}
                                        </pre>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : loadingRun !== exec.run_id ? (
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Run details not available
                          </p>
                        ) : null}
                      </div>
                    )}

                    {/* Notification Status */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Notification: {exec.notification_sent ? (
                          <span className="text-green-600 dark:text-green-400">Sent ✓</span>
                        ) : exec.notification_error ? (
                          <span className="text-red-600 dark:text-red-400">Failed - {exec.notification_error}</span>
                        ) : (
                          <span className="text-gray-400">Not sent</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            </div>
          )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div>
            {notifications.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                No notifications have been sent yet.
                {task.notification_config?.enabled ? ' Notifications will be sent after each execution.' : ' Enable notifications in task settings.'}
              </p>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            notif.status === 'sent' || notif.status === 'delivered' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : notif.status === 'failed'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : notif.status === 'read'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {notif.status}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            via {notif.channel}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            →
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {notif.recipient}
                          </span>
                        </div>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">
                          {notif.subject}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {notif.created_at && formatDateTime(notif.created_at)}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        {notif.sent_at && (
                          <p className="text-green-600 dark:text-green-400">
                            Sent: {formatDateTime(notif.sent_at)}
                          </p>
                        )}
                        {notif.delivered_at && (
                          <p className="text-blue-600 dark:text-blue-400">
                            Delivered: {formatDateTime(notif.delivered_at)}
                          </p>
                        )}
                        {notif.read_at && (
                          <p className="text-purple-600 dark:text-purple-400">
                            Read: {formatDateTime(notif.read_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    {notif.error && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                        <p className="text-red-700 dark:text-red-300 text-sm">
                          Error: {notif.error}
                        </p>
                        {notif.retry_count > 0 && (
                          <p className="text-red-500 dark:text-red-400 text-xs mt-1">
                            Retries: {notif.retry_count}
                          </p>
                        )}
                      </div>
                    )}
                    {notif.message_id && (
                      <p className="text-xs text-gray-400 mt-2">
                        Message ID: {notif.message_id}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div>
            {/* Configuration Summary */}
            {task.insights_config && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`px-2 py-1 rounded ${
                      task.insights_config.enabled 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
                    }`}>
                      {task.insights_config.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Max: {task.insights_config.max_insights || 50} insights
                    </span>
                  </div>
                  <Link
                    href={`/tasks/${taskId}/insights`}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
                  >
                    View full insights page →
                  </Link>
                </div>
              </div>
            )}

            {insights.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🧠</div>
                <p className="text-gray-500 dark:text-gray-400">
                  No insights yet. Insights will be saved after task executions complete successfully.
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                  Insights help avoid sending duplicate information by remembering previous results.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {insights.map((insight) => (
                  <div
                    key={insight.id}
                    className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <p className="text-gray-900 dark:text-gray-100 text-sm">{insight.content}</p>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
                      <span>Created: {formatDateTime(insight.createdAt)}</span>
                      {insight.executionId && (
                        <span>Execution: {insight.executionId.slice(0, 8)}...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        <p>Created: {formatDateTime(task.created_at)}</p>
        <p>Updated: {formatDateTime(task.updated_at)}</p>
        <p>ID: {task.id}</p>
      </div>
    </div>
  );
}
