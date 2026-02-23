'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { WorkflowEditor } from '@/components/workflow';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: any[];
  trigger: any;
  guardrails?: any;
  active: boolean;
}

interface Agent {
  id: string;
  name: string;
  display_name?: string;
}

export default function EditWorkflowPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workflowId = params.id;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load workflow and agents
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Load workflow
        const workflowRes = await fetch(`/api/workflows/${workflowId}`);
        if (!workflowRes.ok) throw new Error('Failed to load workflow');
        const workflowData = await workflowRes.json();
        setWorkflow(workflowData);

        // Load agents
        const agentsRes = await fetch('/api/agents');
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          setAgents(agentsData);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load workflow');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [workflowId]);

  const handleSave = async (updatedWorkflow: any) => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedWorkflow.name,
          description: updatedWorkflow.description,
          steps: updatedWorkflow.steps,
          trigger: updatedWorkflow.trigger,
          guardrails: updatedWorkflow.guardrails,
          is_active: updatedWorkflow.active,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Failed to save workflow (${res.status})`);
      }

      // Navigate to workflow detail page
      router.push(`/workflows/${workflowId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save workflow');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !workflow) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Error Loading Workflow</h3>
          <p className="text-red-600 dark:text-red-300">{error}</p>
          <Link
            href="/workflows"
            className="mt-4 inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Back to Workflows
          </Link>
        </div>
      </div>
    );
  }

  if (!workflow) return null;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/workflows/${workflowId}`}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Edit: {workflow.name}
          </h1>
        </div>
        {saving && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Saving...
          </span>
        )}
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
