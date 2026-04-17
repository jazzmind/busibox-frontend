/**
 * Connection + recent errors panel (Overview tab).
 *
 * Shows live connection metadata, the last error (if any), and the most
 * recent [GRAPH] ring-buffer entries. Provides quick-action buttons to
 * reconnect or trigger a reachability run.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plug,
  Database,
  Cpu,
  Info,
  Trash2,
} from 'lucide-react';
import type { GraphConnection, GraphErrorEntry, ReconnectResult } from './types';

interface Props {
  connection: GraphConnection | null;
  loading: boolean;
  onReconnect: () => Promise<ReconnectResult | null>;
  onRunDiagnostics: () => void;
}

export function GraphConnectionPanel({
  connection,
  loading,
  onReconnect,
  onRunDiagnostics,
}: Props) {
  const [errors, setErrors] = useState<GraphErrorEntry[]>([]);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectResult, setReconnectResult] = useState<ReconnectResult | null>(null);
  const [clearingBuffer, setClearingBuffer] = useState(false);

  const fetchErrors = useCallback(async () => {
    setErrorsLoading(true);
    try {
      const res = await fetch('/api/graph/admin/errors?limit=20');
      if (res.ok) {
        const data = await res.json();
        setErrors(Array.isArray(data.errors) ? data.errors : []);
      }
    } catch {
      // non-critical
    } finally {
      setErrorsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
    const id = setInterval(fetchErrors, 15_000);
    return () => clearInterval(id);
  }, [fetchErrors]);

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const result = await onReconnect();
      if (result) setReconnectResult(result);
      await fetchErrors();
    } finally {
      setReconnecting(false);
    }
  };

  const handleClearBuffer = async () => {
    if (!confirm('Clear the recent errors buffer? This does not delete data.')) return;
    setClearingBuffer(true);
    try {
      await fetch('/api/graph/admin/errors', { method: 'DELETE' });
      await fetchErrors();
    } finally {
      setClearingBuffer(false);
    }
  };

  const available = !!connection?.available;
  const driverInstalled = !!connection?.driver_installed;
  const lastError = connection?.last_connect_error;

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div
        className={`rounded-xl border p-5 ${
          loading
            ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            : available
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {loading ? (
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
            ) : available ? (
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {loading
                ? 'Loading connection state...'
                : available
                ? 'Connected to Neo4j'
                : 'Neo4j unavailable'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {connection?.uri || 'NEO4J_URI not configured'}
              {connection?.user && (
                <span className="ml-2 text-gray-400">as {connection.user}</span>
              )}
            </p>
            {!driverInstalled && !loading && (
              <p className="mt-2 text-sm text-red-700 dark:text-red-400">
                The neo4j Python driver is not installed in data-api.
              </p>
            )}
            {lastError && (
              <div className="mt-3 rounded-md bg-white/60 dark:bg-gray-900/40 border border-red-200 dark:border-red-800/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400 mb-1">
                  Last connect error
                </p>
                <p className="text-sm text-red-800 dark:text-red-300 font-mono break-all">
                  {lastError}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={handleReconnect}
              disabled={reconnecting || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
            >
              {reconnecting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plug className="w-4 h-4" />
              )}
              Reconnect
            </button>
            <button
              onClick={onRunDiagnostics}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              Run diagnostics
            </button>
          </div>
        </div>

        {reconnectResult && (
          <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            Reconnect result: <span className="font-mono">
              {reconnectResult.available ? 'connected' : 'still disconnected'}
            </span>
            {reconnectResult.last_connect_error && (
              <>
                {' '}— <span className="font-mono text-red-600 dark:text-red-400">
                  {reconnectResult.last_connect_error}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Config grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Tile icon={<Cpu className="w-4 h-4" />} label="Driver" value={
          connection?.driver_installed
            ? `neo4j ${connection.driver_version || 'unknown'}`
            : 'Not installed'
        } />
        <Tile icon={<Database className="w-4 h-4" />} label="Server" value={
          connection?.neo4j_version
            ? `${connection.neo4j_version}${connection.neo4j_edition ? ` ${connection.neo4j_edition}` : ''}`
            : '—'
        } />
        <Tile icon={<Info className="w-4 h-4" />} label="APOC" value={
          connection?.apoc_available === true
            ? 'Installed'
            : connection?.apoc_available === false
            ? 'Not installed'
            : 'Unknown'
        } />
      </div>

      {/* Indexes */}
      {connection?.indexes && connection.indexes.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
              Indexes ({connection.indexes.length})
            </h4>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 text-sm max-h-64 overflow-y-auto">
            {connection.indexes.map((idx, i) => (
              <div key={idx.name || i} className="px-4 py-2 flex items-center justify-between">
                <div>
                  <p className="font-mono text-gray-900 dark:text-white text-xs">
                    {idx.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(idx.labelsOrTypes || []).join(', ')}
                    {idx.properties && idx.properties.length > 0 && (
                      <> — {idx.properties.join(', ')}</>
                    )}
                  </p>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
                    idx.state === 'ONLINE'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {idx.state || idx.type || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent errors */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
              Recent [GRAPH] errors
            </h4>
            <span className="text-xs text-gray-400">{errors.length}</span>
            {errorsLoading && <RefreshCw className="w-3 h-3 animate-spin text-gray-400" />}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchErrors}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Refresh
            </button>
            <button
              onClick={handleClearBuffer}
              disabled={clearingBuffer || errors.length === 0}
              className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
        {errors.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            No recent errors. Ring buffer holds up to 200 entries.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
            {errors.map((err, i) => (
              <div key={`${err.timestamp}-${i}`} className="px-4 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                      err.level === 'error'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : err.level === 'warning'
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {err.level}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {err.method}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {new Date(err.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-gray-800 dark:text-gray-200 font-mono break-all">
                  {err.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white truncate">
        {value}
      </p>
    </div>
  );
}
