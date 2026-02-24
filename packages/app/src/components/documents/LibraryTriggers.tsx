'use client';

/**
 * Library Triggers Management Component
 *
 * Simplified UI: select an agent to run when documents complete processing in this library.
 * Triggers automatically fire the selected agent when ingestion finishes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Bell,
  Table2,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  X,
  Loader2,
} from 'lucide-react';
import { useCrossAppApiPath } from '../../contexts/ApiContext';

interface Agent {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface Workflow {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface SchemaDocument {
  id: string;
  name: string;
  filename?: string;
  [key: string]: unknown;
}

type TriggerType = 'run_agent' | 'apply_schema' | 'notify';
type NotificationChannel = 'email' | 'webhook';

interface NotificationConfig {
  channel: NotificationChannel;
  recipient: string;
  subjectTemplate?: string;
  bodyTemplate?: string;
}

interface LibraryTrigger {
  id: string;
  libraryId: string;
  name: string;
  description: string | null;
  triggerType?: TriggerType;
  agentId: string | null;
  prompt: string | null;
  schemaDocumentId: string | null;
  notificationConfig?: NotificationConfig | null;
  isActive: boolean;
  createdBy: string;
  executionCount: number;
  lastExecutionAt: string | null;
  lastError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface LibraryTriggersProps {
  libraryId: string;
  libraryName: string;
  canManage: boolean;
}

export function LibraryTriggers({
  libraryId,
  libraryName,
  canManage,
}: LibraryTriggersProps) {
  const [triggers, setTriggers] = useState<LibraryTrigger[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [schemas, setSchemas] = useState<SchemaDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedTrigger, setExpandedTrigger] = useState<string | null>(null);
  const resolve = useCrossAppApiPath();

  const fetchTriggers = useCallback(async () => {
    if (!libraryId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(resolve('libraries', `/api/libraries/${libraryId}/triggers`), {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch triggers');
      }
      const result = await response.json();
      const data = result.data?.data ?? result.data ?? [];
      setTriggers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load triggers');
    } finally {
      setLoading(false);
    }
  }, [libraryId, resolve]);

  const fetchOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const [agentsResponse, workflowsResponse, schemasResponse] = await Promise.all([
        fetch(resolve('agents', '/api/agents'), { credentials: 'include' }),
        fetch(resolve('agent', '/api/agent/agents/workflows'), { credentials: 'include' }),
        fetch(resolve('data', '/api/data?type=extraction_schema&limit=100'), {
          credentials: 'include',
        }),
      ]);

      if (agentsResponse.ok) {
        const result = await agentsResponse.json();
        const list = result.data?.agents ?? result.agents ?? [];
        setAgents(Array.isArray(list) ? list : []);
      }

      if (workflowsResponse.ok) {
        const result = await workflowsResponse.json();
        setWorkflows(Array.isArray(result) ? result : []);
      }

      if (schemasResponse.ok) {
        const result = await schemasResponse.json();
        const list =
          result.documents ??
          result.data?.documents ??
          result.data ??
          [];
        const mapped = Array.isArray(list)
          ? list.map((schema: Record<string, unknown>) => ({
              id: String(schema.id ?? schema.fileId ?? ''),
              name: String(schema.name ?? schema.filename ?? schema.id ?? ''),
              filename:
                typeof schema.filename === 'string' ? schema.filename : undefined,
            }))
          : [];
        setSchemas(mapped.filter((schema: SchemaDocument) => schema.id));
      }
    } catch (err) {
      console.error('Failed to fetch trigger options:', err);
    } finally {
      setOptionsLoading(false);
    }
  }, [resolve]);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const toggleTrigger = async (triggerId: string, isActive: boolean) => {
    try {
      const response = await fetch(
        resolve('libraries', `/api/libraries/${libraryId}/triggers/${triggerId}`),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ isActive: !isActive }),
        }
      );
      if (response.ok) {
        setTriggers((prev) =>
          prev.map((t) =>
            t.id === triggerId ? { ...t, isActive: !isActive } : t
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle trigger:', err);
    }
  };

  const deleteTrigger = async (triggerId: string) => {
    if (!confirm('Remove this trigger? The agent will no longer run when documents finish processing.')) return;
    try {
      const response = await fetch(
        resolve('libraries', `/api/libraries/${libraryId}/triggers/${triggerId}`),
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      if (response.ok) {
        setTriggers((prev) => prev.filter((t) => t.id !== triggerId));
      }
    } catch (err) {
      console.error('Failed to delete trigger:', err);
    }
  };

  const handleCreateTrigger = async (payload: {
    name: string;
    triggerType: TriggerType;
    agentId?: string;
    prompt?: string;
    schemaDocumentId?: string;
    notificationConfig?: NotificationConfig;
  }) => {
    try {
      const response = await fetch(resolve('libraries', `/api/libraries/${libraryId}/triggers`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setShowCreateForm(false);
        fetchTriggers();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create trigger');
      }
    } catch (err) {
      console.error('Failed to create trigger:', err);
      setError(err instanceof Error ? err.message : 'Failed to create trigger');
    }
  };

  const getRunTargetName = (targetId: string | null) => {
    if (!targetId) return 'Unknown target';
    const agent = agents.find((a) => a.id === targetId);
    if (agent) return agent.name;
    const workflow = workflows.find((w) => w.id === targetId);
    if (workflow) return `${workflow.name} (workflow)`;
    return `${targetId.slice(0, 8)}...`;
  };

  const getSchemaName = (schemaId: string | null) => {
    if (!schemaId) return 'Unknown schema';
    const schema = schemas.find((s) => s.id === schemaId);
    return schema?.name ?? `${schemaId.slice(0, 8)}...`;
  };

  const getTriggerTypeIcon = (triggerType: TriggerType) => {
    if (triggerType === 'notify') return <Bell className="h-4 w-4 text-violet-500" />;
    if (triggerType === 'apply_schema') {
      return <Table2 className="h-4 w-4 text-cyan-500" />;
    }
    return <Zap className="h-4 w-4 text-amber-500" />;
  };

  const getTriggerSummary = (trigger: LibraryTrigger) => {
    const type = trigger.triggerType ?? 'run_agent';
    if (type === 'apply_schema') {
      return `Apply schema: ${getSchemaName(trigger.schemaDocumentId)}`;
    }
    if (type === 'notify') {
      const cfg = trigger.notificationConfig;
      if (!cfg) return 'Notification';
      const label = cfg.channel === 'webhook' ? 'Webhook' : 'Bridge email';
      return `${label}: ${cfg.recipient}`;
    }
    return `Run: ${getRunTargetName(trigger.agentId)}`;
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Run After Processing
          </h3>
          {triggers.length > 0 && (
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
              {triggers.length}
            </span>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            {showCreateForm ? (
              <>
                <X className="h-3 w-3" /> Cancel
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" /> Add Action
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
          {error}
        </div>
      )}

      {showCreateForm && (
        <CreateTriggerForm
          agents={agents}
          workflows={workflows}
          schemas={schemas}
          optionsLoading={optionsLoading}
          onSubmit={handleCreateTrigger}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {triggers.length === 0 && !showCreateForm ? (
        <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <Zap className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p>No post-processing action configured.</p>
          <p className="text-xs mt-1">
            Add an action to run automatically when documents finish processing
            in this library.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {triggers.map((trigger) => (
            <div key={trigger.id} className="px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {getTriggerTypeIcon(trigger.triggerType ?? 'run_agent')}
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${
                        trigger.isActive
                          ? 'bg-green-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {getTriggerSummary(trigger)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 ml-4 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {trigger.executionCount} runs
                    </span>
                    {trigger.lastExecutionAt && (
                      <span>
                        Last:{' '}
                        {new Date(trigger.lastExecutionAt).toLocaleDateString()}
                      </span>
                    )}
                    {trigger.lastError && (
                      <span className="flex items-center gap-1 text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        Error
                      </span>
                    )}
                    {trigger.executionCount > 0 && !trigger.lastError && (
                      <span className="flex items-center gap-1 text-green-500">
                        <CheckCircle className="h-3 w-3" />
                        OK
                      </span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() =>
                        toggleTrigger(trigger.id, trigger.isActive)
                      }
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={
                        trigger.isActive
                          ? 'Disable trigger'
                          : 'Enable trigger'
                      }
                    >
                      {trigger.isActive ? (
                        <ToggleRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        setExpandedTrigger(
                          expandedTrigger === trigger.id ? null : trigger.id
                        )
                      }
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <ChevronDown
                        className={`h-4 w-4 text-gray-400 transition-transform ${
                          expandedTrigger === trigger.id ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => deleteTrigger(trigger.id)}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Remove trigger"
                    >
                      <Trash2 className="h-4 w-4 text-red-400 hover:text-red-600" />
                    </button>
                  </div>
                )}
              </div>

              {expandedTrigger === trigger.id && trigger.lastError && (
                <div className="mt-2 ml-4 p-3 bg-red-50 dark:bg-red-900/20 rounded text-xs">
                  <span className="font-medium text-red-600 dark:text-red-400">
                    Last Error:
                  </span>
                  <p className="mt-1 text-red-600 dark:text-red-400">
                    {trigger.lastError}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTriggerForm({
  agents,
  workflows,
  schemas,
  optionsLoading,
  onSubmit,
  onCancel,
}: {
  agents: Agent[];
  workflows: Workflow[];
  schemas: SchemaDocument[];
  optionsLoading: boolean;
  onSubmit: (payload: {
    name: string;
    triggerType: TriggerType;
    agentId?: string;
    prompt?: string;
    schemaDocumentId?: string;
    notificationConfig?: NotificationConfig;
  }) => void;
  onCancel: () => void;
}) {
  const [triggerType, setTriggerType] = useState<TriggerType>('run_agent');
  const [targetId, setTargetId] = useState('');
  const [schemaDocumentId, setSchemaDocumentId] = useState('');
  const [overrideAgentId, setOverrideAgentId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [notificationChannel, setNotificationChannel] =
    useState<NotificationChannel>('email');
  const [recipient, setRecipient] = useState('');
  const [subjectTemplate, setSubjectTemplate] = useState(
    'Document processed: {{filename}}'
  );
  const [bodyTemplate, setBodyTemplate] = useState(
    'Document {{filename}} completed processing in library {{library_id}}.'
  );
  const [submitting, setSubmitting] = useState(false);

  const runTargets = [
    ...agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      kind: 'agent' as const,
    })),
    ...workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      kind: 'workflow' as const,
    })),
  ];

  useEffect(() => {
    setTargetId('');
    setSchemaDocumentId('');
    setOverrideAgentId('');
    setPrompt('');
    setRecipient('');
  }, [triggerType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (triggerType === 'run_agent' && !targetId) return;
    if (triggerType === 'apply_schema' && !schemaDocumentId) return;
    if (triggerType === 'notify' && !recipient.trim()) return;

    const selectedTarget = runTargets.find((target) => target.id === targetId);
    const selectedSchema = schemas.find((schema) => schema.id === schemaDocumentId);
    setSubmitting(true);
    try {
      if (triggerType === 'run_agent') {
        await onSubmit({
          name: selectedTarget
            ? `Run ${selectedTarget.kind}: ${selectedTarget.name}`
            : `Run target ${targetId.slice(0, 8)}`,
          triggerType: 'run_agent',
          agentId: targetId,
          prompt: prompt || undefined,
        });
      } else if (triggerType === 'apply_schema') {
        await onSubmit({
          name: selectedSchema
            ? `Apply schema: ${selectedSchema.name}`
            : `Apply schema ${schemaDocumentId.slice(0, 8)}`,
          triggerType: 'apply_schema',
          schemaDocumentId,
          agentId: overrideAgentId || undefined,
          prompt: prompt || undefined,
        });
      } else {
        await onSubmit({
          name: `Notify via ${notificationChannel}`,
          triggerType: 'notify',
          notificationConfig: {
            channel: notificationChannel,
            recipient: recipient.trim(),
            subjectTemplate: subjectTemplate.trim() || undefined,
            bodyTemplate: bodyTemplate.trim() || undefined,
          },
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50/50 dark:bg-blue-900/10 space-y-3"
    >
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Action
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setTriggerType('run_agent')}
            className={`px-2 py-1.5 text-xs rounded border ${
              triggerType === 'run_agent'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            Run Agent or Workflow
          </button>
          <button
            type="button"
            onClick={() => setTriggerType('apply_schema')}
            className={`px-2 py-1.5 text-xs rounded border ${
              triggerType === 'apply_schema'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            Apply Schema
          </button>
          <button
            type="button"
            onClick={() => setTriggerType('notify')}
            className={`px-2 py-1.5 text-xs rounded border ${
              triggerType === 'notify'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            Send Notification
          </button>
        </div>
      </div>

      {triggerType === 'run_agent' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Agent or workflow
          </label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            required
            disabled={optionsLoading}
          >
            <option value="">Select a target...</option>
            {runTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name} ({target.kind})
              </option>
            ))}
          </select>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Optional prompt override"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            rows={2}
          />
        </div>
      )}

      {triggerType === 'apply_schema' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Schema
          </label>
          <select
            value={schemaDocumentId}
            onChange={(e) => setSchemaDocumentId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            required
            disabled={optionsLoading}
          >
            <option value="">Select a schema...</option>
            {schemas.map((schema) => (
              <option key={schema.id} value={schema.id}>
                {schema.name}
              </option>
            ))}
          </select>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Optional agent override
          </label>
          <select
            value={overrideAgentId}
            onChange={(e) => setOverrideAgentId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            disabled={optionsLoading}
          >
            <option value="">Use default schema extraction agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Optional prompt override"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            rows={2}
          />
        </div>
      )}

      {triggerType === 'notify' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Channel
          </label>
          <select
            value={notificationChannel}
            onChange={(e) =>
              setNotificationChannel(e.target.value as NotificationChannel)
            }
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="email">Email (Bridge)</option>
            <option value="webhook">Webhook</option>
          </select>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={
              notificationChannel === 'email'
                ? 'Recipient email'
                : 'Webhook URL (https://...)'
            }
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            required
          />
          <input
            value={subjectTemplate}
            onChange={(e) => setSubjectTemplate(e.target.value)}
            placeholder="Subject template"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <textarea
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            placeholder="Body template"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            rows={3}
          />
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Template variables: {'{{filename}}'}, {'{{title}}'}, {'{{library_id}}'},{' '}
            {'{{file_id}}'}, {'{{status}}'}.
          </p>
        </div>
      )}

      {optionsLoading && (
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading options...
          </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={
            submitting ||
            optionsLoading ||
            (triggerType === 'run_agent' && !targetId) ||
            (triggerType === 'apply_schema' && !schemaDocumentId) ||
            (triggerType === 'notify' && !recipient.trim())
          }
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 flex items-center gap-1"
        >
          {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
