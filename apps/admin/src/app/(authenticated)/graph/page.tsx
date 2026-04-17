/**
 * Graph DB admin page.
 *
 * Tabbed layout for managing Neo4j:
 *  - Overview: connection health, recent errors, quick actions
 *  - Stats: label/rel-type counts, orphan summary
 *  - Explorer: browse nodes by label with a side drawer
 *  - Cypher: ad-hoc query console (read by default, write gated)
 *  - Diagnostics: 7-step reachability check
 *  - Admin Ops: reconnect, rebuild indexes, purge orphans
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import {
  Activity,
  BarChart2,
  Compass,
  Terminal,
  ShieldAlert,
  Settings,
  Users,
  RefreshCw,
} from 'lucide-react';
import { GraphConnectionPanel } from '@/components/admin/graph/GraphConnectionPanel';
import { GraphStatsPanel } from '@/components/admin/graph/GraphStatsPanel';
import { GraphExplorer } from '@/components/admin/graph/GraphExplorer';
import { CypherConsole } from '@/components/admin/graph/CypherConsole';
import {
  GraphDiagnostics,
  type GraphDiagnosticsHandle,
} from '@/components/admin/graph/GraphDiagnostics';
import { GraphAdminOps } from '@/components/admin/graph/GraphAdminOps';
import { GraphPermissionsPanel } from '@/components/admin/graph/GraphPermissionsPanel';
import type {
  GraphConnection,
  GraphStats,
  ReconnectResult,
} from '@/components/admin/graph/types';

type TabId =
  | 'overview'
  | 'stats'
  | 'explorer'
  | 'cypher'
  | 'diagnostics'
  | 'permissions'
  | 'ops';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
  { id: 'stats', label: 'Stats', icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'explorer', label: 'Explorer', icon: <Compass className="w-4 h-4" /> },
  { id: 'cypher', label: 'Cypher', icon: <Terminal className="w-4 h-4" /> },
  { id: 'diagnostics', label: 'Diagnostics', icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'permissions', label: 'Permissions', icon: <Users className="w-4 h-4" /> },
  { id: 'ops', label: 'Admin Ops', icon: <Settings className="w-4 h-4" /> },
];

export default function GraphAdminPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<TabId>('overview');
  const [connection, setConnection] = useState<GraphConnection | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loadingConn, setLoadingConn] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const diagnosticsRef = useRef<GraphDiagnosticsHandle>(null);

  useEffect(() => {
    if (!user) {
      window.location.href = '/portal/login';
      return;
    }
    if (!user.roles?.includes('Admin')) {
      window.location.href = '/portal/home';
    }
  }, [user]);

  const fetchConnection = useCallback(async () => {
    setLoadingConn(true);
    try {
      const res = await fetch('/api/graph/admin/connection');
      if (res.ok) {
        setConnection((await res.json()) as GraphConnection);
      }
    } finally {
      setLoadingConn(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/graph/admin/stats');
      if (res.ok) {
        setStats((await res.json()) as GraphStats);
      }
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchConnection();
    fetchStats();
  }, [fetchConnection, fetchStats]);

  const refreshAll = async () => {
    await Promise.all([fetchConnection(), fetchStats()]);
  };

  const runDiagnostics = () => {
    setTab('diagnostics');
    // defer until tab content mounts
    setTimeout(() => diagnosticsRef.current?.run(), 50);
  };

  const handleReconnect = async (): Promise<ReconnectResult | null> => {
    try {
      const res = await fetch('/api/graph/admin/reconnect', { method: 'POST' });
      if (!res.ok) return null;
      const result = (await res.json()) as ReconnectResult;
      await refreshAll();
      return result;
    } catch {
      return null;
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Graph DB
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Neo4j health, explorer, Cypher console, and maintenance.
              </p>
            </div>
            <HeaderBadge connection={connection} loading={loadingConn} />
          </div>

          <div className="mt-4 flex items-center gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {tab === 'overview' && (
          <GraphConnectionPanel
            connection={connection}
            loading={loadingConn}
            onReconnect={handleReconnect}
            onRunDiagnostics={runDiagnostics}
          />
        )}
        {tab === 'stats' && (
          <GraphStatsPanel
            stats={stats}
            loading={loadingStats}
            onRefresh={fetchStats}
          />
        )}
        {tab === 'explorer' && (
          <GraphExplorer
            labels={stats?.labels || []}
            availableHint={
              connection?.available === false
                ? 'Graph not available'
                : null
            }
          />
        )}
        {tab === 'cypher' && <CypherConsole />}
        {tab === 'diagnostics' && <GraphDiagnostics ref={diagnosticsRef} />}
        {tab === 'permissions' && <GraphPermissionsPanel />}
        {tab === 'ops' && (
          <GraphAdminOps onReconnected={() => refreshAll()} />
        )}
      </main>
    </div>
  );
}

function HeaderBadge({
  connection,
  loading,
}: {
  connection: GraphConnection | null;
  loading: boolean;
}) {
  if (loading && !connection) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        Loading
      </span>
    );
  }
  const ok = !!connection?.available;
  return (
    <span
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${
        ok
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          ok ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`}
      />
      {ok ? 'Connected' : 'Disconnected'}
      {connection?.uri && (
        <span className="ml-1 font-mono text-[10px] text-gray-500 dark:text-gray-500 truncate max-w-[200px]">
          {connection.uri}
        </span>
      )}
    </span>
  );
}
