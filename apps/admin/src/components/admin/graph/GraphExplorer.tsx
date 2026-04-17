/**
 * Explorer tab: label filter + search + paginated table + node drawer.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { GraphBrowseResponse, GraphLabelCount } from './types';
import { GraphNodeDrawer } from './GraphNodeDrawer';

interface Props {
  labels: GraphLabelCount[];
  availableHint: string | null;
}

const PAGE_SIZE = 50;

export function GraphExplorer({ labels, availableHint }: Props) {
  const [label, setLabel] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<GraphBrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<
    (Record<string, unknown> & { _labels?: string[] }) | null
  >(null);

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [label, searchDebounced, ownerFilter]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (label) params.set('label', label);
      if (searchDebounced) params.set('search', searchDebounced);
      if (ownerFilter) params.set('owner_id', ownerFilter);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));
      const res = await fetch(`/api/graph/admin/browse?${params.toString()}`);
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as GraphBrowseResponse;
      setData(json);
      if (json.error) setError(json.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [label, searchDebounced, ownerFilter, page]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const total = data?.total ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Label
          </label>
          <select
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
          >
            <option value="">All labels</option>
            {labels.map((l) => (
              <option key={l.label} value={l.label}>
                {l.label} ({l.count.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Search name / node_id
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Substring..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            Owner ID (optional)
          </label>
          <input
            type="text"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            placeholder="User UUID"
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono"
          />
        </div>
        <button
          onClick={fetchPage}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {total === 0
            ? 'No matching nodes'
            : `Showing ${showingFrom}-${showingTo} of ${total.toLocaleString()}`}
        </span>
        {availableHint && <span>{availableHint}</span>}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        {error && (
          <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20">
            {error}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Labels</th>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">node_id</th>
              <th className="px-4 py-2 font-semibold">Owner</th>
              <th className="px-4 py-2 font-semibold">Visibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading && (!data || data.nodes.length === 0) ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                </td>
              </tr>
            ) : (data?.nodes || []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No nodes match the current filters.
                </td>
              </tr>
            ) : (
              (data?.nodes || []).map((node, i) => {
                const labelsForRow = (node._labels as string[] | undefined) || [];
                return (
                  <tr
                    key={`${node.node_id || i}`}
                    onClick={() => setSelectedNode(node)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {labelsForRow
                          .filter((l) => l !== 'GraphNode')
                          .map((l) => (
                            <span
                              key={l}
                              className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                            >
                              {l}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-gray-900 dark:text-white">
                      {(node.name as string) || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2 align-top text-xs font-mono text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {String(node.node_id ?? '')}
                    </td>
                    <td className="px-4 py-2 align-top text-xs font-mono text-gray-600 dark:text-gray-400">
                      {String(node.owner_id || '').slice(0, 8) || '—'}
                    </td>
                    <td className="px-4 py-2 align-top text-xs">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold ${
                          node.visibility === 'shared'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {String(node.visibility || 'personal')}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Page {page + 1} of {maxPage + 1}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
          disabled={page >= maxPage || loading}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {selectedNode && (
        <GraphNodeDrawer
          node={selectedNode as Parameters<typeof GraphNodeDrawer>[0]['node']}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
