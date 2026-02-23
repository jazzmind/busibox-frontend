/**
 * Admin Dashboard
 *
 * Observability over built-in (non-personal) agents and recent runs.
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDateTime } from '@jazzmind/busibox-app/lib/date-utils';
import type { Agent, Run } from '@/lib/types';

export default function AdminDashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [agentsRes, runsRes] = await Promise.all([
          fetch('/api/agents'),
          fetch('/api/runs?limit=25'),
        ]);

        if (!agentsRes.ok) {
          const a = await agentsRes.json().catch(() => ({}));
          throw new Error(a.error || `Failed to load agents (${agentsRes.status})`);
        }

        const agentsData = (await agentsRes.json()) as Agent[];
        const runsData = await runsRes.json().catch(() => []);

        setAgents(
          (Array.isArray(agentsData) ? agentsData : []).map((a) => ({
            ...a,
            is_builtin: Boolean((a as any).is_builtin),
            is_personal: !Boolean((a as any).is_builtin),
          }))
        );
        setRuns(Array.isArray(runsData) ? runsData : runsData.items || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load admin data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const builtinAgents = useMemo(() => agents.filter((a) => a.is_builtin), [agents]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin</h1>
          <p className="text-gray-600 mt-1">Observability for built-in (non-personal) agents.</p>
        </div>
        <Link href="/" className="text-sm text-gray-600 hover:text-blue-600">
          ← Back to dashboard
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Built-in Agents</h2>
        {loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : builtinAgents.length === 0 ? (
          <div className="text-gray-600">No built-in agents found.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {builtinAgents.map((a) => (
              <div key={a.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">{a.display_name || a.name}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {a.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-1 line-clamp-2">{a.description || 'No description'}</div>
                <div className="text-xs text-gray-500 mt-2">Model: {a.model}</div>
                <div className="mt-3">
                  <Link href={`/agent/${a.id}`} className="text-sm text-blue-600 hover:text-blue-800">
                    View details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Runs</h2>
        {loading ? (
          <div className="text-gray-600">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="text-gray-600">No runs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Agent</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Run ID</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {runs.slice(0, 25).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 pr-4">{r.status}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/agent/${r.agent_id}`} className="text-blue-600 hover:text-blue-800">
                        {r.agent_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{formatDateTime(r.created_at)}</td>
                    <td className="py-2 pr-4">{r.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}



