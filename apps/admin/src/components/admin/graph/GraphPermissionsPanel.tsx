/**
 * Permissions debugger. Compares what a given user can see vs the total in
 * the database, with a per-label breakdown. Defaults to the current admin.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Eye, EyeOff, UserCheck } from 'lucide-react';
import type { PermissionsBreakdown } from './types';

export function GraphPermissionsPanel() {
  const [userId, setUserId] = useState('');
  const [data, setData] = useState<PermissionsBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async (uid?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (uid) params.set('user_id', uid);
      const res = await fetch(`/api/graph/admin/permissions?${params.toString()}`);
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as PermissionsBreakdown;
      setData(json);
      if (json.error) setError(json.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const total = data?.total_nodes ?? 0;
  const visible = data?.visible_to_user ?? 0;
  const hiddenPct = total > 0 ? Math.round(((total - visible) / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
            User ID (blank = you)
          </label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="UUID"
            className="w-full px-3 py-2 font-mono text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
          />
        </div>
        <button
          onClick={() => fetchPermissions(userId.trim() || undefined)}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
          Check visibility
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatTile
            icon={<Eye className="w-4 h-4 text-green-500" />}
            label="Visible to user"
            value={visible}
          />
          <StatTile
            icon={<EyeOff className="w-4 h-4 text-gray-400" />}
            label="Hidden by RLS"
            value={total - visible}
            hint={total > 0 ? `${hiddenPct}% of total` : undefined}
          />
          <StatTile
            icon={<UserCheck className="w-4 h-4 text-indigo-500" />}
            label="Total in graph"
            value={total}
          />
        </div>
      )}

      {data?.per_label && data.per_label.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
              Per-label breakdown
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Visible (owned + shared) vs total, by node label.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 font-semibold">Label</th>
                <th className="px-4 py-2 font-semibold text-right">Visible</th>
                <th className="px-4 py-2 font-semibold text-right">Total</th>
                <th className="px-4 py-2 font-semibold">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.per_label.map((row) => {
                const pct = row.total > 0 ? Math.round((row.visible / row.total) * 100) : 0;
                return (
                  <tr key={row.label}>
                    <td className="px-4 py-2 font-mono text-gray-900 dark:text-white">
                      {row.label}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900 dark:text-white">
                      {row.visible.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
                      {row.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-indigo-500' : 'bg-gray-300'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
        {value.toLocaleString()}
      </p>
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}
