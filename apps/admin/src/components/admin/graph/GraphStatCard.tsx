/**
 * Graph DB stat card for the admin dashboard.
 *
 * Polls `/api/graph/admin/connection` + `/api/graph/admin/stats` periodically
 * and renders a compact status card. Clicking the card navigates to the
 * full Graph DB admin page.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Network,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import type { GraphConnection, GraphStats } from './types';

type Status = 'connected' | 'disconnected' | 'degraded' | 'loading';

function pickStatus(
  conn: GraphConnection | null,
  stats: GraphStats | null,
): Status {
  if (!conn) return 'loading';
  if (!conn.driver_installed) return 'disconnected';
  if (!conn.available) return 'disconnected';
  if (stats && !stats.available) return 'degraded';
  const orphans = stats?.orphans;
  if (orphans && (orphans.no_node_id > 0 || orphans.dangling_rels > 0)) {
    return 'degraded';
  }
  return 'connected';
}

export function GraphStatCard() {
  const [conn, setConn] = useState<GraphConnection | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [connRes, statsRes] = await Promise.all([
        fetch('/api/graph/admin/connection'),
        fetch('/api/graph/admin/stats'),
      ]);
      if (connRes.ok) setConn(await connRes.json());
      else setError(`connection: HTTP ${connRes.status}`);
      if (statsRes.ok) setStats(await statsRes.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const status = pickStatus(conn, stats);

  const statusBadge = (() => {
    if (status === 'loading') {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Loading
        </span>
      );
    }
    if (status === 'connected') {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
          <CheckCircle className="w-3 h-3" />
          Connected
        </span>
      );
    }
    if (status === 'degraded') {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-3 h-3" />
          Degraded
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
        <XCircle className="w-3 h-3" />
        Disconnected
      </span>
    );
  })();

  const nodes = stats?.total_nodes ?? 0;
  const rels = stats?.total_relationships ?? 0;

  return (
    <Link
      href="/graph"
      className="group block bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
          <Network className="w-4 h-4 text-indigo-500" />
          Graph DB
        </div>
        <div className="flex items-center gap-2">
          {refreshing && (
            <RefreshCw className="w-3 h-3 text-gray-300 dark:text-gray-500 animate-spin" />
          )}
          {statusBadge}
        </div>
      </div>

      <div className="flex items-baseline gap-4 mb-1">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            {nodes.toLocaleString()}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Nodes
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            {rels.toLocaleString()}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Relationships
          </p>
        </div>
      </div>

      {status === 'disconnected' && conn?.last_connect_error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400 line-clamp-2">
          {conn.last_connect_error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 truncate">
          {conn?.uri || 'Neo4j not configured'}
        </p>
      )}

      <div className="mt-2 flex items-center text-xs text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
        Open Graph DB console
        <ChevronRight className="w-3 h-3 ml-0.5" />
      </div>
      {error && (
        <p className="mt-1 text-[10px] text-red-500 truncate" title={error}>
          {error}
        </p>
      )}
    </Link>
  );
}
