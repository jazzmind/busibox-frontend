'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WorkflowEditor } from '@/components/workflow';

interface Agent {
  id: string;
  name: string;
  display_name?: string;
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showBasicForm, setShowBasicForm] = useState(true);

  const [workflow, setWorkflow] = useState({
    name: '',
    description: '',
    steps: [] as any[],
    trigger: { type: 'manual', config: {} },
    guardrails: {},
    active: true,
  });

  // Load agents for the editor
  useEffect(() => {
    fetch('/api/agents')
      .then((res) => res.json())
      .then((data) => setAgents(data))
      .catch(() => setAgents([]));
  }, []);

  const canSubmit = Boolean(workflow.name.trim());

  const handleBasicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    
    // Move to visual editor
    setShowBasicForm(false);
  };

  const handleSave = async (updatedWorkflow: any) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedWorkflow.name.trim(),
          description: updatedWorkflow.description?.trim() || undefined,
          steps: updatedWorkflow.steps || [],
          trigger: updatedWorkflow.trigger || { type: 'manual', config: {} },
          guardrails: updatedWorkflow.guardrails || {},
          is_active: updatedWorkflow.active ?? true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(data.error || `Failed to create workflow (${res.status})`);
      }

      router.push(`/workflows/${data.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to create workflow');
      setSubmitting(false);
    }
  };

  // Show basic form first to get name/description
  if (showBasicForm) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">New Workflow</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Create a new workflow automation.</p>
          </div>
          <Link href="/workflows" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
            ← Back
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleBasicSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Workflow Name *
            </label>
            <input
              value={workflow.name}
              onChange={(e) => setWorkflow((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="my-awesome-workflow"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Unique identifier for this workflow (kebab-case recommended)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={workflow.description}
              onChange={(e) => setWorkflow((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 min-h-[100px]"
              placeholder="What does this workflow do?"
            />
          </div>

          {/* Trigger Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Trigger Type
            </label>
            <select
              value={workflow.trigger.type}
              onChange={(e) =>
                setWorkflow((p) => ({
                  ...p,
                  trigger: { type: e.target.value, config: {} },
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="manual">👆 Manual - Triggered by user</option>
              <option value="cron">⏰ Cron - Scheduled execution</option>
              <option value="webhook">🔗 Webhook - HTTP endpoint</option>
              <option value="event">📡 Event - External event</option>
            </select>
          </div>

          {/* Global Guardrails */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              🛡️ Global Guardrails (Optional)
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Requests
                </label>
                <input
                  type="number"
                  value={(workflow.guardrails as any)?.request_limit || ''}
                  onChange={(e) =>
                    setWorkflow((p) => ({
                      ...p,
                      guardrails: {
                        ...p.guardrails,
                        request_limit: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    }))
                  }
                  placeholder="e.g., 10"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={(workflow.guardrails as any)?.total_tokens_limit || ''}
                  onChange={(e) =>
                    setWorkflow((p) => ({
                      ...p,
                      guardrails: {
                        ...p.guardrails,
                        total_tokens_limit: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    }))
                  }
                  placeholder="e.g., 50000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Timeout (sec)
                </label>
                <input
                  type="number"
                  value={(workflow.guardrails as any)?.timeout_seconds || ''}
                  onChange={(e) =>
                    setWorkflow((p) => ({
                      ...p,
                      guardrails: {
                        ...p.guardrails,
                        timeout_seconds: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    }))
                  }
                  placeholder="e.g., 120"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href="/workflows"
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Continue to Visual Editor →
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Show visual editor
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowBasicForm(true)}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {workflow.name}
          </h1>
          {workflow.description && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {workflow.description}
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 my-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1">
        <WorkflowEditor
          workflow={workflow}
          onSave={handleSave}
          agents={agents}
        />
      </div>
    </div>
  );
}
