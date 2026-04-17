/**
 * Side drawer showing full properties and 1-hop neighbors of a graph node.
 *
 * Uses the existing `/data/graph/entity/{id}` endpoint (via the proxy) so we
 * get the same RLS-filtered view the rest of the product uses.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, RefreshCw } from 'lucide-react';

interface NodeLike {
  node_id?: string;
  name?: string;
  _labels?: string[];
  [key: string]: unknown;
}

interface Neighbor {
  node_id?: string;
  name?: string;
  _labels?: string[];
  [key: string]: unknown;
}

interface Props {
  node: NodeLike | null;
  onClose: () => void;
}

export function GraphNodeDrawer({ node, onClose }: Props) {
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNeighbors = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const body = {
        query:
          'MATCH (n:GraphNode {node_id: $id})-[r]-(m:GraphNode) ' +
          'RETURN m.node_id AS node_id, coalesce(m.name, m.node_id) AS name, ' +
          'labels(m) AS labels, type(r) AS rel_type LIMIT 50',
        params: { id },
        allow_write: false,
        timeout_sec: 15,
      };
      const res = await fetch('/api/graph/admin/cypher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data.ok === false) {
        setError(data.error || 'Query failed');
        return;
      }
      const cols: string[] = data.columns || [];
      const rows: unknown[][] = data.rows || [];
      const idxId = cols.indexOf('node_id');
      const idxName = cols.indexOf('name');
      const idxLabels = cols.indexOf('labels');
      const idxRel = cols.indexOf('rel_type');
      setNeighbors(
        rows.map((row) => ({
          node_id: String(row[idxId] ?? ''),
          name: String(row[idxName] ?? ''),
          _labels: Array.isArray(row[idxLabels]) ? (row[idxLabels] as string[]) : [],
          _rel_type: String(row[idxRel] ?? ''),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (node?.node_id) {
      fetchNeighbors(node.node_id);
    }
  }, [node, fetchNeighbors]);

  if (!node) return null;

  const props = Object.entries(node).filter(
    ([k]) => !k.startsWith('_') && k !== 'node_id' && k !== 'name',
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="w-full max-w-lg bg-white dark:bg-gray-900 shadow-xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {String(node.name || node.node_id)}
            </h3>
            <div className="flex flex-wrap gap-1 mt-1">
              {(node._labels || []).map((l) => (
                <span
                  key={l}
                  className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <section>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Properties
            </h4>
            {props.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No properties beyond node_id.
              </p>
            ) : (
              <dl className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                <div className="py-1.5 grid grid-cols-[120px_1fr] gap-2">
                  <dt className="font-mono text-xs text-gray-500 dark:text-gray-400">
                    node_id
                  </dt>
                  <dd className="font-mono text-xs text-gray-900 dark:text-white break-all">
                    {String(node.node_id ?? '')}
                  </dd>
                </div>
                {props.map(([k, v]) => (
                  <div key={k} className="py-1.5 grid grid-cols-[120px_1fr] gap-2">
                    <dt className="font-mono text-xs text-gray-500 dark:text-gray-400">
                      {k}
                    </dt>
                    <dd className="text-xs text-gray-900 dark:text-white break-all">
                      {renderValue(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                Neighbors ({neighbors.length})
              </h4>
              {loading && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-400" />
              )}
            </div>
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                {error}
              </p>
            )}
            {neighbors.length === 0 && !loading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No neighbors found (or not visible to you).
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                {neighbors.map((n, i) => (
                  <li key={`${n.node_id}-${i}`} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white truncate">
                          {n.name || n.node_id}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(n._labels || []).map((l) => (
                            <span
                              key={l}
                              className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-mono text-cyan-600 dark:text-cyan-400 flex-shrink-0 ml-2">
                        {String((n as Neighbor & { _rel_type?: string })._rel_type || '')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
