/**
 * Dashboard (root route)
 *
 * NOTE: This app is deployed with Next.js `basePath="/agents"`, so this route
 * is served externally as `/agents`.
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Agent } from '@/lib/types';
import { AgentList } from '@/components/agents/AgentList';
import { useAuth } from '@jazzmind/busibox-app';

type DashboardStats = {
  personalActive: number;
  personalTotal: number;
  builtinActive: number;
  builtinTotal: number;
  totalActive: number;
  total: number;
};

export default function DashboardPage() {
  const { isReady, refreshKey } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    if (!isReady) {
      return;
    }
    
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/agents', {
          credentials: 'include', // Include cookies for auth
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to load agents (${res.status})`);
        }
        const data = (await res.json()) as Agent[];
        console.log('[Dashboard] Loaded agents:', data.length, 'agents');
        console.log('[Dashboard] Sample agent:', data[0]);
        
        const normalized = (Array.isArray(data) ? data : []).map((a) => ({
          ...a,
          is_builtin: Boolean(a.is_builtin),
          is_personal: !Boolean(a.is_builtin),
        }));
        
        console.log('[Dashboard] Built-in agents:', normalized.filter(a => a.is_builtin).length);
        console.log('[Dashboard] Personal agents:', normalized.filter(a => a.is_personal).length);
        
        setAgents(normalized);
      } catch (e: any) {
        console.error('[Dashboard] Failed to load agents:', e);
        setError(e?.message || 'Failed to load agents');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isReady, refreshKey]);

  const stats: DashboardStats = useMemo(() => {
    const builtin = agents.filter((a) => a.is_builtin);
    const personal = agents.filter((a) => !a.is_builtin);

    return {
      personalActive: personal.filter((a) => a.is_active).length,
      personalTotal: personal.length,
      builtinActive: builtin.filter((a) => a.is_active).length,
      builtinTotal: builtin.length,
      totalActive: agents.filter((a) => a.is_active).length,
      total: agents.length,
    };
  }, [agents]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Agents</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Personal agents you’ve deployed, plus built-in agents available to you.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/new"
            className="px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center space-x-2"
          >
            <span className="text-lg leading-none">+</span>
            <span>New Agent</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          <div className="font-medium">Failed to load agents</div>
          <div className="text-sm mt-1">{error}</div>
          <div className="text-sm mt-2">
            If you’re not logged in, go back to the Busibox Portal and authenticate, then reopen Agent Manager.
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Personal active agents</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {stats.personalActive}
            <span className="text-sm text-gray-500 dark:text-gray-400 font-normal"> / {stats.personalTotal}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Built-in active agents</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {stats.builtinActive}
            <span className="text-sm text-gray-500 dark:text-gray-400 font-normal"> / {stats.builtinTotal}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total active agents</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {stats.totalActive}
            <span className="text-sm text-gray-500 dark:text-gray-400 font-normal"> / {stats.total}</span>
          </div>
        </div>
      </div>

      {/* Agent list */}
      <AgentList agents={agents} isLoading={loading} />
    </div>
  );
}
