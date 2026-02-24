'use client';

/**
 * Evals Dashboard — /evals
 *
 * Overview of eval datasets, recent runs, and production quality scores.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

// ─── types ────────────────────────────────────────────────────────────────────

interface Dataset {
  id: string;
  name: string;
  description?: string;
  agent_id?: string;
  tags: string[];
  is_active: boolean;
  scenario_count: number;
  created_at: string;
}

interface EvalRun {
  id: string;
  dataset_id?: string;
  name?: string;
  status: string;
  scorers: string[];
  total_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  avg_score?: number;
  duration_seconds?: number;
  created_at: string;
  completed_at?: string;
}

interface RoutingAccuracy {
  days: number;
  routing_accuracy: {
    avg_score?: number;
    total_scored: number;
    passed?: number;
    pass_rate?: number;
  };
  agent_distribution: Record<string, number>;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700';
    case 'running': return 'bg-blue-100 text-blue-700';
    case 'failed': return 'bg-red-100 text-red-700';
    case 'pending': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function scoreColor(score?: number) {
  if (score == null) return 'text-gray-500';
  if (score >= 0.8) return 'text-green-600 font-semibold';
  if (score >= 0.6) return 'text-yellow-600 font-semibold';
  return 'text-red-600 font-semibold';
}

function fmtPct(val?: number) {
  if (val == null) return '—';
  return `${Math.round(val * 100)}%`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function EvalsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [routing, setRouting] = useState<RoutingAccuracy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dataset dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [datasetsRes, runsRes, routingRes] = await Promise.all([
        fetch('/api/evals/datasets'),
        fetch('/api/evals/runs?limit=10'),
        fetch('/api/evals/observability/routing/accuracy?days=7'),
      ]);

      setDatasets(datasetsRes.ok ? await datasetsRes.json() : []);
      setRuns(runsRes.ok ? await runsRes.json() : []);
      setRouting(routingRes.ok ? await routingRes.json() : null);
    } catch (e: any) {
      setError(e.message || 'Failed to load eval data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateDataset = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/evals/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create dataset');
      }
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  // Compute summary stats
  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === 'completed');
  const avgPassRate =
    completedRuns.length > 0
      ? completedRuns.reduce(
          (sum, r) => sum + (r.total_scenarios > 0 ? r.passed_scenarios / r.total_scenarios : 0),
          0,
        ) / completedRuns.length
      : null;
  const recentAvgScore =
    completedRuns.length > 0
      ? completedRuns.reduce((sum, r) => sum + (r.avg_score ?? 0), 0) / completedRuns.length
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evals &amp; Observability</h1>
          <p className="text-gray-600 mt-1">
            Test agents across scenarios, monitor production quality, and improve over time.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          + New Dataset
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Datasets"
          value={String(datasets.length)}
          sub={`${datasets.reduce((s, d) => s + d.scenario_count, 0)} scenarios total`}
        />
        <StatCard
          label="Eval Runs (recent)"
          value={String(totalRuns)}
          sub={`${completedRuns.length} completed`}
        />
        <StatCard
          label="Avg Pass Rate"
          value={fmtPct(avgPassRate ?? undefined)}
          sub="across recent runs"
        />
        <StatCard
          label="Routing Accuracy"
          value={fmtPct(routing?.routing_accuracy?.pass_rate)}
          sub={`${routing?.routing_accuracy?.total_scored ?? 0} scored (7d)`}
        />
      </div>

      {/* Datasets */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Eval Datasets</h2>
        </div>
        {loading ? (
          <div className="text-gray-500 text-sm">Loading…</div>
        ) : datasets.length === 0 ? (
          <div className="text-gray-500 text-sm">
            No datasets yet.{' '}
            <button
              className="text-blue-600 hover:underline"
              onClick={() => setShowCreate(true)}
            >
              Create your first dataset →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Scenarios</th>
                  <th className="pb-2 pr-4 font-medium">Agent</th>
                  <th className="pb-2 pr-4 font-medium">Created</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {datasets.map((ds) => (
                  <tr key={ds.id} className="border-t hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/evals/datasets/${ds.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {ds.name}
                      </Link>
                      {ds.description && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {ds.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">{ds.scenario_count}</td>
                    <td className="py-3 pr-4">
                      {ds.agent_id ? (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {ds.agent_id}
                        </span>
                      ) : (
                        <span className="text-gray-400">all</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{fmtDate(ds.created_at)}</td>
                    <td className="py-3">
                      <Link
                        href={`/evals/datasets/${ds.id}`}
                        className="text-sm text-blue-600 hover:text-blue-800 mr-3"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Runs */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Eval Runs</h2>
        </div>
        {loading ? (
          <div className="text-gray-500 text-sm">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="text-gray-500 text-sm">No eval runs yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Pass Rate</th>
                  <th className="pb-2 pr-4 font-medium">Avg Score</th>
                  <th className="pb-2 pr-4 font-medium">Scenarios</th>
                  <th className="pb-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {runs.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/evals/runs/${r.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {r.name || r.id.substring(0, 8)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {r.status === 'completed' && r.total_scenarios > 0
                        ? fmtPct(r.passed_scenarios / r.total_scenarios)
                        : '—'}
                    </td>
                    <td className={`py-3 pr-4 ${scoreColor(r.avg_score)}`}>
                      {r.avg_score != null ? r.avg_score.toFixed(2) : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      {r.total_scenarios > 0
                        ? `${r.passed_scenarios}/${r.total_scenarios}`
                        : '—'}
                    </td>
                    <td className="py-3 text-gray-500">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Routing distribution */}
      {routing && Object.keys(routing.agent_distribution).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Agent Routing Distribution (7 days)
          </h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(routing.agent_distribution)
              .sort(([, a], [, b]) => b - a)
              .map(([agent, count]) => (
                <div
                  key={agent}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                >
                  <span className="font-medium text-sm text-gray-800">{agent}</span>
                  <span className="text-xs text-gray-500">{count} msgs</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Create Dataset Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">New Eval Dataset</h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Chat Agent Routing Suite"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDataset()}
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Optional description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                onClick={handleCreateDataset}
                disabled={creating || !newName.trim()}
              >
                {creating ? 'Creating…' : 'Create Dataset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
