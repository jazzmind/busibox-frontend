'use client';

/**
 * Eval Run Results Viewer — /evals/runs/[runId]
 *
 * Per-scenario score breakdown, trace viewer, and failure analysis.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ─── types ────────────────────────────────────────────────────────────────────

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
  error?: string;
  created_at: string;
  completed_at?: string;
}

interface EvalScore {
  id: string;
  scenario_id?: string;
  scorer_name: string;
  score: number;
  passed: boolean;
  details: Record<string, any>;
  grading_model?: string;
  source: string;
  created_at: string;
}

interface FailureAnalysis {
  total_failures: number;
  failure_modes: Record<string, { count: number; examples: Array<{ scenario_name: string; query: string; details: any }> }>;
  suggestions: Array<{ category: string; priority: string; suggestion: string; rationale: string; example_change?: string }>;
  message?: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const cls = {
    completed: 'bg-green-100 text-green-700',
    running: 'bg-blue-100 text-blue-700 animate-pulse',
    failed: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  }[status] ?? 'bg-gray-100 text-gray-600';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{status}</span>;
}

function scoreBar(score: number, passed: boolean) {
  const color = passed ? 'bg-green-500' : score >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score * 100}%` }} />
      </div>
      <span className={`text-xs font-medium ${passed ? 'text-green-700' : 'text-red-600'}`}>
        {score.toFixed(2)}
      </span>
    </div>
  );
}

function priorityBadge(priority: string) {
  const cls = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-gray-100 text-gray-600' }[priority] ?? 'bg-gray-100 text-gray-600';
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{priority}</span>;
}

// ─── Score table grouped by scenario ─────────────────────────────────────────

function ScoresTable({ scores }: { scores: EvalScore[] }) {
  const byScenario: Record<string, EvalScore[]> = {};
  for (const s of scores) {
    const key = s.scenario_id ?? 'no-scenario';
    (byScenario[key] ??= []).push(s);
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-2">
      {Object.entries(byScenario).map(([scenId, scenScores]) => {
        const allPassed = scenScores.every((s) => s.passed);
        const avgScore =
          scenScores.reduce((sum, s) => sum + s.score, 0) / scenScores.length;
        const isOpen = expanded[scenId];

        return (
          <div
            key={scenId}
            className={`border rounded-lg ${allPassed ? 'border-green-200' : 'border-red-200'}`}
          >
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 rounded-lg"
              onClick={() => setExpanded((p) => ({ ...p, [scenId]: !p[scenId] }))}
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs w-4 h-4 flex items-center justify-center rounded-full font-bold ${allPassed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  {allPassed ? '✓' : '✗'}
                </span>
                <span className="text-sm font-medium text-gray-800">
                  Scenario{' '}
                  <span className="text-gray-500 font-normal">{scenId.substring(0, 8)}…</span>
                </span>
              </div>
              <div className="flex items-center gap-4">
                {scoreBar(avgScore, allPassed)}
                <span className="text-xs text-gray-500">
                  {scenScores.filter((s) => s.passed).length}/{scenScores.length} passed
                </span>
                <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-3 border-t border-gray-100">
                <table className="min-w-full text-xs mt-2">
                  <thead className="text-gray-500 border-b">
                    <tr>
                      <th className="pb-1.5 pr-4 text-left font-medium">Scorer</th>
                      <th className="pb-1.5 pr-4 text-left font-medium">Score</th>
                      <th className="pb-1.5 pr-4 text-left font-medium">Passed</th>
                      <th className="pb-1.5 text-left font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenScores.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="py-1.5 pr-4 font-mono">{s.scorer_name}</td>
                        <td className="py-1.5 pr-4">{scoreBar(s.score, s.passed)}</td>
                        <td className="py-1.5 pr-4">
                          {s.passed ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-red-600">✗</span>
                          )}
                        </td>
                        <td className="py-1.5 text-gray-600">
                          {s.details?.reasoning && (
                            <span className="italic">{s.details.reasoning}</span>
                          )}
                          {s.details?.error && (
                            <span className="text-red-600">{s.details.error}</span>
                          )}
                          {!s.details?.reasoning && !s.details?.error && (
                            <span className="text-gray-400">
                              {JSON.stringify(s.details).substring(0, 80)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function EvalRunPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;

  const [run, setRun] = useState<EvalRun | null>(null);
  const [scores, setScores] = useState<EvalScore[]>([]);
  const [analysis, setAnalysis] = useState<FailureAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyFailed, setShowOnlyFailed] = useState(false);

  // Poll while running
  const load = useCallback(async () => {
    try {
      const [runRes, scoresRes] = await Promise.all([
        fetch(`/api/evals/runs/${runId}`),
        fetch(`/api/evals/runs/${runId}/scores`),
      ]);
      const runData: EvalRun = await runRes.json();
      setRun(runData);
      setScores(scoresRes.ok ? await scoresRes.json() : []);
      return runData.status;
    } catch (e: any) {
      setError(e.message || 'Failed to load run');
      return 'error';
    }
  }, [runId]);

  useEffect(() => {
    setLoading(true);
    load().then((status) => {
      setLoading(false);
      if (status === 'running' || status === 'pending') {
        // Poll every 3s while running
        const interval = setInterval(async () => {
          const s = await load();
          if (s !== 'running' && s !== 'pending') clearInterval(interval);
        }, 3000);
        return () => clearInterval(interval);
      }
    });
  }, [load]);

  const loadAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch(`/api/evals/runs/${runId}/analysis`);
      setAnalysis(res.ok ? await res.json() : null);
    } catch {
      setAnalysis(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const filteredScores = showOnlyFailed
    ? scores.filter((s) => !s.passed)
    : scores;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error || 'Run not found'}
        </div>
        <Link href="/evals" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
          ← Back to Evals
        </Link>
      </div>
    );
  }

  const passRate =
    run.total_scenarios > 0 ? run.passed_scenarios / run.total_scenarios : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="text-sm text-gray-500 mb-1">
          <Link href="/evals" className="hover:text-blue-600">Evals</Link>{' '}
          {run.dataset_id && (
            <>
              /{' '}
              <Link href={`/evals/datasets/${run.dataset_id}`} className="hover:text-blue-600">
                Dataset
              </Link>
            </>
          )}{' '}
          / Run
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">
            {run.name || `Run ${run.id.substring(0, 8)}`}
          </h1>
          {statusBadge(run.status)}
        </div>
        {run.status === 'running' || run.status === 'pending' ? (
          <p className="text-sm text-blue-600 mt-1 animate-pulse">
            Running… (auto-refreshing every 3s)
          </p>
        ) : null}
      </div>

      {run.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Error: {run.error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500">Pass Rate</div>
          <div className={`text-2xl font-bold mt-1 ${passRate != null && passRate >= 0.8 ? 'text-green-600' : passRate != null && passRate >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
            {passRate != null ? `${Math.round(passRate * 100)}%` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {run.passed_scenarios}/{run.total_scenarios} scenarios
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500">Avg Score</div>
          <div className={`text-2xl font-bold mt-1 ${run.avg_score != null && run.avg_score >= 0.8 ? 'text-green-600' : run.avg_score != null && run.avg_score >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
            {run.avg_score != null ? run.avg_score.toFixed(2) : '—'}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500">Duration</div>
          <div className="text-2xl font-bold mt-1 text-gray-900">
            {run.duration_seconds != null ? `${run.duration_seconds.toFixed(1)}s` : '—'}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500">Scorers</div>
          <div className="text-xs font-medium text-gray-700 mt-1 space-y-0.5">
            {run.scorers.map((s) => (
              <div key={s} className="bg-gray-100 rounded px-1.5 py-0.5 inline-block mr-1">{s}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Score results */}
      {scores.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Per-Scenario Results</h2>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyFailed}
                onChange={(e) => setShowOnlyFailed(e.target.checked)}
                className="rounded"
              />
              Show only failures
            </label>
          </div>
          <ScoresTable scores={filteredScores} />
        </div>
      )}

      {/* Failure analysis */}
      {run.status === 'completed' && run.failed_scenarios > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Failure Analysis</h2>
            {!analysis && (
              <button
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                onClick={loadAnalysis}
                disabled={analysisLoading}
              >
                {analysisLoading ? 'Analyzing…' : '🔍 Analyze Failures'}
              </button>
            )}
          </div>

          {analysis ? (
            <div className="space-y-4">
              {analysis.message ? (
                <p className="text-green-600 text-sm">{analysis.message}</p>
              ) : (
                <>
                  {/* Failure mode breakdown */}
                  {Object.keys(analysis.failure_modes).length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Failure Modes</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(analysis.failure_modes).map(([mode, { count }]) => (
                          <div key={mode} className="border border-red-200 bg-red-50 rounded-lg p-3">
                            <div className="text-sm font-medium text-red-800">{mode}</div>
                            <div className="text-xl font-bold text-red-600">{count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {analysis.suggestions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Improvement Suggestions
                      </h3>
                      <div className="space-y-3">
                        {analysis.suggestions.map((s, i) => (
                          <div
                            key={i}
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                {priorityBadge(s.priority)}
                                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                  {s.category}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{s.suggestion}</p>
                            <p className="text-xs text-gray-600 mt-1">{s.rationale}</p>
                            {s.example_change && (
                              <pre className="text-xs bg-gray-50 rounded p-2 mt-2 text-gray-700 overflow-x-auto">
                                {s.example_change}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Click "Analyze Failures" to get AI-driven improvement suggestions based on the
              failure patterns in this run.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
