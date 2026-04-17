/**
 * Cypher console (Cypher tab).
 *
 * Plain textarea editor + Run button. Read-only by default; writes require
 * the "Allow writes" toggle + a confirm modal. Query history is kept in
 * localStorage for convenience. Results rendered as a table.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Play,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  History,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import type { CypherResponse } from './types';

const HISTORY_KEY = 'busibox_cypher_history';
const HISTORY_LIMIT = 20;

const SAMPLE_QUERIES: Array<{ label: string; query: string }> = [
  {
    label: 'Count by label',
    query:
      'MATCH (n:GraphNode)\nUNWIND labels(n) AS label\nWITH label WHERE label <> \'GraphNode\'\nRETURN label, count(*) AS count\nORDER BY count DESC LIMIT 50',
  },
  {
    label: 'Recent Documents',
    query:
      'MATCH (d:Document)\nRETURN d.node_id AS id, d.name AS name, d.library_id AS library, d.owner_id AS owner\nORDER BY d.node_id DESC LIMIT 20',
  },
  {
    label: 'Top entities by mentions',
    query:
      'MATCH (e)-[r:MENTIONED_IN]->(d:Document)\nRETURN e.name AS entity, labels(e) AS labels, count(r) AS mentions\nORDER BY mentions DESC LIMIT 20',
  },
  {
    label: 'Orphan nodes',
    query:
      'MATCH (n:GraphNode)\nWHERE NOT (n)--() AND NOT n:DataDocument AND NOT n:Document\nRETURN labels(n) AS labels, n.node_id AS id, n.name AS name LIMIT 50',
  },
];

export function CypherConsole() {
  const [query, setQuery] = useState<string>(SAMPLE_QUERIES[0].query);
  const [allowWrites, setAllowWrites] = useState(false);
  const [pendingWrite, setPendingWrite] = useState(false);
  const [timeoutSec, setTimeoutSec] = useState(30);
  const [result, setResult] = useState<CypherResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const pushHistory = useCallback((q: string) => {
    setHistory((prev) => {
      const next = [q, ...prev.filter((h) => h !== q)].slice(0, HISTORY_LIMIT);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
  };

  const runQuery = useCallback(async (allowWrite: boolean) => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/graph/admin/cypher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          params: {},
          allow_write: allowWrite,
          timeout_sec: timeoutSec,
        }),
      });
      const data = (await res.json()) as CypherResponse;
      setResult(data);
      pushHistory(query);
    } catch (e) {
      setResult({
        ok: false,
        error: e instanceof Error ? e.message : 'Request failed',
        columns: [],
        rows: [],
      });
    } finally {
      setRunning(false);
    }
  }, [query, timeoutSec, pushHistory]);

  const handleRun = () => {
    if (allowWrites) {
      setPendingWrite(true);
    } else {
      runQuery(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Cypher
          </span>
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            {SAMPLE_QUERIES.map((sq) => (
              <button
                key={sq.label}
                onClick={() => setQuery(sq.query)}
                className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
              >
                {sq.label}
              </button>
            ))}
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
            >
              <History className="w-3 h-3" />
              History ({history.length})
            </button>
          </div>
        </div>
        {historyOpen && history.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 max-h-40 overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Recent queries
              </span>
              <button
                onClick={clearHistory}
                className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
            <ul className="space-y-1">
              {history.map((h, i) => (
                <li key={`${h}-${i}`}>
                  <button
                    onClick={() => { setQuery(h); setHistoryOpen(false); }}
                    className="w-full text-left text-xs font-mono text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 truncate"
                    title={h}
                  >
                    {h.replace(/\s+/g, ' ').slice(0, 120)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="w-full px-4 py-3 min-h-[160px] font-mono text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 focus:outline-none resize-y"
          placeholder="MATCH (n:GraphNode) RETURN count(n) LIMIT 10"
        />
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3 flex-wrap bg-gray-50 dark:bg-gray-800/50">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={allowWrites}
              onChange={(e) => setAllowWrites(e.target.checked)}
              className="rounded"
            />
            {allowWrites ? (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                Allow writes
              </span>
            ) : (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Read-only
              </span>
            )}
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            Timeout
            <input
              type="number"
              min={1}
              max={300}
              value={timeoutSec}
              onChange={(e) => setTimeoutSec(Math.max(1, Math.min(300, Number(e.target.value))))}
              className="w-16 px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-xs"
            />
            s
          </label>
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
            Cmd/Ctrl+Enter to run
          </span>
          <button
            onClick={handleRun}
            disabled={running || query.trim().length === 0}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 ${
              allowWrites
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <Play className="w-4 h-4" />
            {running ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      {result && <ResultView result={result} />}

      {pendingWrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md mx-4 p-6 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40">
                <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Run write query?
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              This query may modify the graph database. It will be logged with
              your user ID.
            </p>
            <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded mb-4 overflow-x-auto font-mono text-gray-800 dark:text-gray-200 max-h-40">
              {query}
            </pre>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingWrite(false)}
                className="px-4 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => { setPendingWrite(false); runQuery(true); }}
                className="px-4 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                Run write query
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultView({ result }: { result: CypherResponse }) {
  if (!result.ok) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm mb-1">
          <AlertTriangle className="w-4 h-4" />
          Query failed
        </div>
        <pre className="text-xs font-mono text-red-800 dark:text-red-300 whitespace-pre-wrap">
          {result.error || 'Unknown error'}
        </pre>
      </div>
    );
  }

  const { columns, rows, summary, duration_ms } = result;
  const counters = summary?.counters || {};
  const hasUpdates = counters.contains_updates === true;
  const notifications = summary?.notifications || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap text-xs text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold">
          <CheckCircle className="w-3.5 h-3.5" />
          OK
        </span>
        <span>{rows.length} row{rows.length === 1 ? '' : 's'}</span>
        {duration_ms !== undefined && (
          <span>{duration_ms.toFixed(1)} ms</span>
        )}
        {summary?.query_type && (
          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded uppercase font-mono text-[10px]">
            {summary.query_type}
          </span>
        )}
        {hasUpdates && (
          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-[10px]">
            contains updates
          </span>
        )}
      </div>

      {Object.keys(counters).length > 0 && hasUpdates && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(counters)
            .filter(([, v]) => typeof v === 'number' && v > 0)
            .map(([k, v]) => (
              <span
                key={k}
                className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-mono"
              >
                {k}: {String(v)}
              </span>
            ))}
        </div>
      )}

      {notifications.length > 0 && (
        <div className="space-y-1">
          {notifications.map((n, i) => (
            <div
              key={i}
              className="text-xs px-3 py-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
            >
              <span className="font-semibold">{n.severity || 'NOTIFY'}</span>
              {' — '}
              {n.title || n.code}
              {n.description && <>: <span className="text-gray-600 dark:text-gray-400">{n.description}</span></>}
            </div>
          ))}
        </div>
      )}

      {columns.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-auto max-h-[500px]">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 align-top text-xs font-mono text-gray-900 dark:text-white max-w-md truncate">
                      {renderCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function renderCell(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}
