/**
 * Stats panel (Stats tab).
 *
 * Shows node counts by label, relationship counts by type, and an
 * orphans summary. Re-renders from the parent's stats prop.
 */

'use client';

import { RefreshCw, Tag, Link2, AlertTriangle } from 'lucide-react';
import type { GraphStats } from './types';

interface Props {
  stats: GraphStats | null;
  loading: boolean;
  onRefresh: () => void;
}

export function GraphStatsPanel({ stats, loading, onRefresh }: Props) {
  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!stats || !stats.available) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Graph DB is not currently available. Check the Overview tab for connection details.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-white">
              {stats.total_nodes.toLocaleString()}
            </span>{' '}
            nodes across{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {stats.labels.length}
            </span>{' '}
            labels,{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {stats.total_relationships.toLocaleString()}
            </span>{' '}
            relationships across{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {stats.relationship_types.length}
            </span>{' '}
            types
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CountsTable
          icon={<Tag className="w-4 h-4 text-indigo-500" />}
          title="Node labels"
          rows={stats.labels.map((l) => ({ key: l.label, count: l.count }))}
          total={stats.total_nodes}
        />
        <CountsTable
          icon={<Link2 className="w-4 h-4 text-cyan-500" />}
          title="Relationship types"
          rows={stats.relationship_types.map((r) => ({ key: r.type, count: r.count }))}
          total={stats.total_relationships}
        />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
            Orphans
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-700">
          <OrphanCell
            label="Nodes without node_id"
            value={stats.orphans.no_node_id}
          />
          <OrphanCell
            label="Nodes with no relationships"
            value={stats.orphans.no_relationships}
            hint="Excludes DataDocument / Document"
          />
          <OrphanCell
            label="Dangling relationships"
            value={stats.orphans.dangling_rels}
          />
        </div>
        {stats.orphans.error && (
          <p className="px-4 py-2 text-xs text-red-600 dark:text-red-400 border-t border-gray-100 dark:border-gray-700">
            Error collecting orphan counts: {stats.orphans.error}
          </p>
        )}
      </div>
    </div>
  );
}

function CountsTable({
  icon,
  title,
  rows,
  total,
}: {
  icon: React.ReactNode;
  title: string;
  rows: Array<{ key: string; count: number }>;
  total: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        {icon}
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
          {title}
        </h4>
        <span className="text-xs text-gray-400 ml-auto">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
          None found.
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
          {rows.map((row) => {
            const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
            return (
              <div key={row.key} className="px-4 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-mono text-gray-900 dark:text-white truncate">
                    {row.key}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 flex-shrink-0 ml-2">
                    {row.count.toLocaleString()}
                    <span className="text-xs text-gray-400 ml-1">({pct}%)</span>
                  </span>
                </div>
                <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrphanCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  const bad = value > 0;
  return (
    <div className="px-4 py-3">
      <p
        className={`text-2xl font-bold ${
          bad ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'
        }`}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
      {hint && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}
