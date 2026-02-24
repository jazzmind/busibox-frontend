'use client';

/**
 * Dataset / Scenario Editor — /evals/datasets/[datasetId]
 *
 * View and edit scenarios, run the dataset.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

// ─── types ────────────────────────────────────────────────────────────────────

interface Dataset {
  id: string;
  name: string;
  description?: string;
  agent_id?: string;
  scenario_count: number;
  tags: string[];
}

interface Scenario {
  id: string;
  name: string;
  query: string;
  expected_agent?: string;
  expected_tools?: string[];
  expected_output_contains?: string[];
  expected_outcome?: string;
  tags: string[];
  is_active: boolean;
}

const DEFAULT_SCORERS = ['success', 'llm_quality', 'routing_accuracy'];

// ─── Scenario row ─────────────────────────────────────────────────────────────

function ScenarioRow({
  scenario,
  onDelete,
  onEdit,
}: {
  scenario: Scenario;
  onDelete: (id: string) => void;
  onEdit: (s: Scenario) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete scenario "${scenario.name}"?`)) return;
    setDeleting(true);
    await fetch(`/api/evals/scenarios/${scenario.id}`, { method: 'DELETE' });
    onDelete(scenario.id);
  };

  return (
    <tr className="border-t hover:bg-gray-50">
      <td className="py-3 pr-4">
        <div className="font-medium text-gray-900">{scenario.name}</div>
        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{scenario.query}</div>
      </td>
      <td className="py-3 pr-4 text-sm text-gray-600">
        {scenario.expected_agent || <span className="text-gray-400">any</span>}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-600">
        {scenario.expected_tools?.join(', ') || <span className="text-gray-400">—</span>}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-600">
        {scenario.expected_output_contains?.join(', ') || <span className="text-gray-400">—</span>}
      </td>
      <td className="py-3">
        <button
          className="text-sm text-blue-600 hover:text-blue-800 mr-3"
          onClick={() => onEdit(scenario)}
        >
          Edit
        </button>
        <button
          className="text-sm text-red-600 hover:text-red-800 disabled:opacity-40"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? '…' : 'Delete'}
        </button>
      </td>
    </tr>
  );
}

// ─── Scenario form ────────────────────────────────────────────────────────────

function ScenarioForm({
  initial,
  datasetId,
  onSave,
  onClose,
}: {
  initial?: Scenario | null;
  datasetId: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [query, setQuery] = useState(initial?.query ?? '');
  const [expectedAgent, setExpectedAgent] = useState(initial?.expected_agent ?? '');
  const [expectedTools, setExpectedTools] = useState(initial?.expected_tools?.join(', ') ?? '');
  const [expectedContains, setExpectedContains] = useState(
    initial?.expected_output_contains?.join(', ') ?? '',
  );
  const [expectedOutcome, setExpectedOutcome] = useState(initial?.expected_outcome ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim() || !query.trim()) {
      setError('Name and query are required');
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      query: query.trim(),
      expected_agent: expectedAgent.trim() || undefined,
      expected_tools: expectedTools.trim()
        ? expectedTools.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      expected_output_contains: expectedContains.trim()
        ? expectedContains.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      expected_outcome: expectedOutcome.trim() || undefined,
    };

    try {
      const url = initial
        ? `/api/evals/scenarios/${initial.id}`
        : `/api/evals/datasets/${datasetId}/scenarios`;
      const method = initial ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save scenario');
      }
      onSave();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg my-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {initial ? 'Edit Scenario' : 'Add Scenario'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Resume search query"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Query (test input) *</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Do I have any resumes for data analysts?"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expected Agent <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={expectedAgent}
          onChange={(e) => setExpectedAgent(e.target.value)}
          placeholder="e.g. chat, status-assistant"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expected Tools{' '}
          <span className="text-gray-400 font-normal">(comma-separated, optional)</span>
        </label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={expectedTools}
          onChange={(e) => setExpectedTools(e.target.value)}
          placeholder="e.g. document_search, web_search"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Response Must Contain{' '}
          <span className="text-gray-400 font-normal">(comma-separated, optional)</span>
        </label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={expectedContains}
          onChange={(e) => setExpectedContains(e.target.value)}
          placeholder="e.g. resume, document"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expected Outcome <span className="text-gray-400 font-normal">(optional free text)</span>
        </label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          value={expectedOutcome}
          onChange={(e) => setExpectedOutcome(e.target.value)}
          placeholder="Describe the expected behavior or outcome"
        />

        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Scenario'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function DatasetEditorPage() {
  const params = useParams<{ datasetId: string }>();
  const router = useRouter();
  const datasetId = params.datasetId;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScenarioForm, setShowScenarioForm] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [running, setRunning] = useState(false);
  const [scorers, setScorers] = useState(DEFAULT_SCORERS);
  const [runName, setRunName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dsRes, scenRes] = await Promise.all([
        fetch(`/api/evals/datasets/${datasetId}`),
        fetch(`/api/evals/datasets/${datasetId}/scenarios`),
      ]);
      if (!dsRes.ok) throw new Error('Dataset not found');
      setDataset(await dsRes.json());
      setScenarios(scenRes.ok ? await scenRes.json() : []);
    } catch (e: any) {
      setError(e.message || 'Failed to load dataset');
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRunEval = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/evals/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: datasetId,
          scorers,
          name: runName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to start eval run');
      }
      const run = await res.json();
      router.push(`/evals/runs/${run.id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error || 'Dataset not found'}
        </div>
        <Link href="/evals" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
          ← Back to Evals
        </Link>
      </div>
    );
  }

  const toggleScorer = (s: string) =>
    setScorers((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-gray-500 mb-1">
            <Link href="/evals" className="hover:text-blue-600">Evals</Link> / {dataset.name}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{dataset.name}</h1>
          {dataset.description && (
            <p className="text-gray-600 mt-1 text-sm">{dataset.description}</p>
          )}
        </div>
        <button
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          onClick={() => { setEditingScenario(null); setShowScenarioForm(true); }}
        >
          + Add Scenario
        </button>
      </div>

      {/* Run panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-blue-900 mb-3">Run this Dataset</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {['success', 'latency', 'llm_quality', 'tool_selection', 'routing_accuracy', 'output_contains'].map(
            (s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm text-blue-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scorers.includes(s)}
                  onChange={() => toggleScorer(s)}
                  className="rounded"
                />
                {s}
              </label>
            ),
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            className="border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Optional run name"
            value={runName}
            onChange={(e) => setRunName(e.target.value)}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            onClick={handleRunEval}
            disabled={running || scenarios.length === 0}
          >
            {running ? 'Starting…' : `▶ Run Eval (${scenarios.length} scenarios)`}
          </button>
        </div>
      </div>

      {/* Scenarios table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Scenarios ({scenarios.length})
        </h2>
        {scenarios.length === 0 ? (
          <div className="text-gray-500 text-sm">
            No scenarios yet.{' '}
            <button
              className="text-blue-600 hover:underline"
              onClick={() => { setEditingScenario(null); setShowScenarioForm(true); }}
            >
              Add your first scenario →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Name / Query</th>
                  <th className="pb-2 pr-4 font-medium">Expected Agent</th>
                  <th className="pb-2 pr-4 font-medium">Expected Tools</th>
                  <th className="pb-2 pr-4 font-medium">Must Contain</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {scenarios.map((s) => (
                  <ScenarioRow
                    key={s.id}
                    scenario={s}
                    onDelete={(id) => setScenarios((prev) => prev.filter((x) => x.id !== id))}
                    onEdit={(sc) => { setEditingScenario(sc); setShowScenarioForm(true); }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showScenarioForm && (
        <ScenarioForm
          initial={editingScenario}
          datasetId={datasetId}
          onSave={async () => {
            setShowScenarioForm(false);
            setEditingScenario(null);
            await load();
          }}
          onClose={() => { setShowScenarioForm(false); setEditingScenario(null); }}
        />
      )}
    </div>
  );
}
