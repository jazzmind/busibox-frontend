'use client';

/**
 * Edit Task Page
 * Form to edit an existing agent task.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@jazzmind/busibox-app';

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

type TargetType = 'agent' | 'workflow';

interface NotificationChannelConfig {
  channel: string;
  recipient: string;
  enabled: boolean;
}

interface LinkedChannelBinding {
  id: string;
  channel_type: string;
  external_id: string | null;
  verified_at: string | null;
}

interface NotificationOption {
  value: string;
  label: string;
  icon: string;
  recipient?: string;
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
  };
  insights_config: {
    enabled?: boolean;
    max_insights?: number;
    purge_after_days?: number;
  };
  output_saving_config?: {
    enabled?: boolean;
    tags?: string[];
    library_type?: string;
  };
  status: string;
}

const SCHEDULE_PRESETS = [
  { value: '*/5 * * * *', label: 'Every 5 minutes' },
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '*/30 * * * *', label: 'Every 30 minutes' },
  { value: '0 * * * *', label: 'Hourly' },
  { value: '0 */2 * * *', label: 'Every 2 hours' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 9 * * *', label: 'Daily (9 AM)' },
  { value: '0 18 * * *', label: 'Daily Evening (6 PM)' },
  { value: '0 9 * * 1', label: 'Weekly (Monday 9 AM)' },
  { value: '0 9 1 * *', label: 'Monthly (1st, 9 AM)' },
  { value: 'custom', label: 'Custom Cron Expression' },
];

const NOTIFICATION_CHANNELS = [
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'teams', label: 'Microsoft Teams', icon: '💬' },
  { value: 'slack', label: 'Slack', icon: '💬' },
  { value: 'webhook', label: 'Webhook', icon: '🔗' },
];

export default function EditTaskPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const { isReady } = useAuth();
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('agent');
  const [agentId, setAgentId] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [schedulePreset, setSchedulePreset] = useState('custom');
  const [customCron, setCustomCron] = useState('0 9 * * *');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannelConfig[]>([
    { channel: 'email', recipient: '', enabled: false }
  ]);
  const [insightsEnabled, setInsightsEnabled] = useState(true);
  const [maxInsights, setMaxInsights] = useState(50);
  const [linkedChannelOptions, setLinkedChannelOptions] = useState<NotificationOption[]>([]);
  
  // Output saving state
  const [outputSavingEnabled, setOutputSavingEnabled] = useState(false);
  const [outputSavingTags, setOutputSavingTags] = useState('');

  useEffect(() => {
    if (!isReady) return;
    loadData();
  }, [isReady, taskId]);

  const loadData = async () => {
    try {
      // Load task, agents, and workflows in parallel
      const [taskResponse, agentsResponse, workflowsResponse, bindingsResponse] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch('/api/agents'),
        fetch('/api/workflows'),
        fetch('/api/account/channel-bindings'),
      ]);

      if (!taskResponse.ok) throw new Error('Failed to load task');
      if (!agentsResponse.ok) throw new Error('Failed to load agents');

      const task: Task = await taskResponse.json();
      const agentsList: Agent[] = await agentsResponse.json();

      setAgents(agentsList);
      
      if (workflowsResponse.ok) {
        const workflowsList: Workflow[] = await workflowsResponse.json();
        setWorkflows(workflowsList);
      }

      if (bindingsResponse.ok) {
        const bindingsData = await bindingsResponse.json().catch(() => ({ bindings: [] }));
        const bindings = Array.isArray(bindingsData.bindings)
          ? (bindingsData.bindings as LinkedChannelBinding[])
          : [];
        const bridgeOptions = bindings
          .filter((binding) => binding.verified_at && binding.external_id)
          .map((binding) => {
            const channelType = (binding.channel_type || '').toLowerCase();
            const externalId = String(binding.external_id || '');
            return {
              value: `bridge_${channelType}`,
              label: `Linked ${channelType.charAt(0).toUpperCase()}${channelType.slice(1)}`,
              icon: channelType === 'telegram' ? '✈️' : channelType === 'signal' ? '🔐' : channelType === 'discord' ? '🎮' : '💬',
              recipient: externalId,
            } satisfies NotificationOption;
          });
        setLinkedChannelOptions(bridgeOptions);
      }
      
      // Populate form with task data
      setName(task.name);
      setDescription(task.description || '');
      
      // Determine target type from task
      if (task.workflow_id) {
        setTargetType('workflow');
        setWorkflowId(task.workflow_id);
        setAgentId('');
      } else {
        setTargetType('agent');
        setAgentId(task.agent_id || '');
        setWorkflowId('');
      }
      
      setPrompt(task.prompt);
      
      // Handle cron schedule
      const cron = task.trigger_config?.cron || '0 9 * * *';
      const matchingPreset = SCHEDULE_PRESETS.find(p => p.value === cron);
      if (matchingPreset && matchingPreset.value !== 'custom') {
        setSchedulePreset(cron);
      } else {
        setSchedulePreset('custom');
        setCustomCron(cron);
      }
      
      // Notifications - handle both old single-channel and new multi-channel formats
      if (task.notification_config) {
        setNotificationsEnabled(task.notification_config.enabled || false);
        
        // Check for new multi-channel format
        if (task.notification_config.channels && task.notification_config.channels.length > 0) {
          setNotificationChannels(task.notification_config.channels);
        } else if (task.notification_config.channel && task.notification_config.recipient) {
          // Convert legacy single-channel to multi-channel format
          setNotificationChannels([{
            channel: task.notification_config.channel,
            recipient: task.notification_config.recipient,
            enabled: true,
          }]);
        }
      }
      
      // Insights
      if (task.insights_config) {
        setInsightsEnabled(task.insights_config.enabled ?? true);
        setMaxInsights(task.insights_config.max_insights || 50);
      }
      
      // Output saving
      if (task.output_saving_config) {
        setOutputSavingEnabled(task.output_saving_config.enabled ?? false);
        setOutputSavingTags((task.output_saving_config.tags || []).join(', '));
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const notificationOptions: NotificationOption[] = [...NOTIFICATION_CHANNELS, ...linkedChannelOptions];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasTarget = targetType === 'agent' ? agentId : workflowId;
    if (!name.trim() || !prompt.trim() || !hasTarget) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate that at least one channel has a recipient if notifications enabled
    if (notificationsEnabled) {
      const enabledChannels = notificationChannels.filter(ch => ch.enabled && ch.recipient.trim());
      if (enabledChannels.length === 0) {
        setError('Please configure at least one notification channel with a recipient');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      // Build update payload
      const updatePayload: any = {
        name,
        description: description || null,
        prompt,
        trigger_config: {
          cron: schedulePreset === 'custom' ? customCron : schedulePreset,
        },
        notification_config: notificationsEnabled ? {
          enabled: true,
          channels: notificationChannels.filter(ch => ch.enabled && ch.recipient.trim()),
          include_summary: true,
          include_portal_link: true,
          on_success: true,
          on_failure: true,
        } : { enabled: false },
        // Include agent_id or workflow_id based on target type
        // When switching, we need to clear the other field
        ...(targetType === 'agent' 
          ? { agent_id: agentId, workflow_id: null } 
          : { workflow_id: workflowId, agent_id: null }
        ),
        insights_config: {
          enabled: insightsEnabled,
          max_insights: maxInsights,
          purge_after_days: 30,
          include_in_context: true,
          context_limit: 10,
        },
        output_saving_config: outputSavingEnabled ? {
          enabled: true,
          library_type: 'TASKS',
          tags: outputSavingTags.split(',').map(t => t.trim()).filter(t => t),
          on_success_only: true,
        } : { enabled: false },
      };

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to update task');
      }

      router.push(`/tasks/${taskId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/tasks/${taskId}`}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-4 inline-block"
        >
          ← Back to Task
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Task</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Update task configuration and schedule
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Basic Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Task Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Daily AI News Summary"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this task does"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Execute *
              </label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setTargetType('agent')}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    targetType === 'agent'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🤖</span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">Agent</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Run a single agent</div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('workflow')}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    targetType === 'workflow'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">Workflow</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Run a multi-step workflow</div>
                    </div>
                  </div>
                </button>
              </div>
              
              {targetType === 'agent' ? (
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">Select an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.display_name || agent.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="">Select a workflow...</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name} {workflow.is_builtin ? '(Built-in)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prompt / Instructions *
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="What should the agent do?"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>
          </div>
        </div>

        {/* Schedule Configuration */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Schedule</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Schedule
              </label>
              <select
                value={schedulePreset}
                onChange={(e) => setSchedulePreset(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {SCHEDULE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              
              {schedulePreset === 'custom' && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Cron Expression (minute hour day month day_of_week)
                  </label>
                  <input
                    type="text"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="0 9 * * *"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Enable</span>
            </label>
          </div>
          
          {notificationsEnabled && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure one or more notification channels. Enable multiple channels to receive notifications on all of them.
              </p>
              
              {/* Channel list */}
              <div className="space-y-3">
                {notificationOptions.map((channelDef) => {
                  const channelConfig = notificationChannels.find(ch => ch.channel === channelDef.value);
                  const isEnabled = channelConfig?.enabled || false;
                  const recipient = channelConfig?.recipient || '';
                  const isBridgeLinkedChannel = channelDef.value.startsWith('bridge_');
                  
                  return (
                    <div 
                      key={channelDef.value}
                      className={`border rounded-lg p-4 transition-colors ${
                        isEnabled 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{channelDef.icon}</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {channelDef.label}
                          </span>
                        </div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => {
                              setNotificationChannels(prev => {
                                const existing = prev.find(ch => ch.channel === channelDef.value);
                                if (existing) {
                                  return prev.map(ch => 
                                    ch.channel === channelDef.value 
                                      ? { ...ch, enabled: e.target.checked }
                                      : ch
                                  );
                                } else {
                                  return [...prev, { 
                                    channel: channelDef.value, 
                                    recipient: channelDef.recipient || '',
                                    enabled: e.target.checked 
                                  }];
                                }
                              });
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Enable</span>
                        </label>
                      </div>
                      
                      {isEnabled && (
                        <div>
                          {isBridgeLinkedChannel ? (
                            <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm">
                              Linked recipient: {recipient || channelDef.recipient || 'Unknown'}
                            </div>
                          ) : (
                            <input
                              type={channelDef.value === 'email' ? 'email' : 'url'}
                              value={recipient}
                              onChange={(e) => {
                                setNotificationChannels(prev => 
                                  prev.map(ch => 
                                    ch.channel === channelDef.value 
                                      ? { ...ch, recipient: e.target.value }
                                      : ch
                                  )
                                );
                              }}
                              placeholder={
                                channelDef.value === 'email' 
                                  ? 'you@example.com' 
                                  : channelDef.value === 'teams'
                                    ? 'https://outlook.office.com/webhook/...'
                                    : channelDef.value === 'slack'
                                      ? 'https://hooks.slack.com/services/...'
                                      : 'https://your-webhook-url.com/...'
                              }
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                            />
                          )}
                          {channelDef.value === 'teams' && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Get this URL from: Teams channel &rarr; Connectors &rarr; Incoming Webhook
                            </p>
                          )}
                          {channelDef.value === 'slack' && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Get this URL from: Slack App &rarr; Incoming Webhooks
                            </p>
                          )}
                          {isBridgeLinkedChannel && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Sends via your linked bridge channel identity.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Task Memory */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Task Memory</h2>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={insightsEnabled}
                onChange={(e) => setInsightsEnabled(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Enable</span>
            </label>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Task memory helps the agent remember previous results to avoid sending duplicate information.
          </p>
          
          {insightsEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Insights to Keep
              </label>
              <input
                type="number"
                value={maxInsights}
                onChange={(e) => setMaxInsights(parseInt(e.target.value) || 50)}
                min={1}
                max={500}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          )}
        </div>

        {/* Output Saving */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Save Output to Library
              </h2>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={outputSavingEnabled}
                onChange={(e) => setOutputSavingEnabled(e.target.checked)}
                className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Enable</span>
            </label>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Automatically save task outputs to your Tasks library for future reference and search.
          </p>
          
          {outputSavingEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={outputSavingTags}
                onChange={(e) => setOutputSavingTags(e.target.value)}
                placeholder="e.g., research, weekly, report"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use tags to organize and filter saved outputs in your Tasks library.
              </p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href={`/tasks/${taskId}`}
            className="px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
