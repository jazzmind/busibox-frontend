/**
 * Tools Management Page
 * 
 * View and configure available tools including API keys, provider settings,
 * and scoped configurations (global, agent-specific, or personal).
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Tool } from '@/lib/types';
import { ToolList } from '@/components/tools/ToolList';
import { useAuth } from '@jazzmind/busibox-app';

export default function ToolsPage() {
  const { isReady, refreshKey } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    if (!isReady) {
      return;
    }
    loadTools();
  }, [isReady, refreshKey]);

  async function loadTools() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tools', { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load tools (${res.status})`);
      }
      const data = await res.json();
      console.log('[Tools] Loaded tools:', data.length, 'tools');
      setTools(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('[Tools] Failed to load tools:', e);
      setError(e?.message || 'Failed to load tools');
    } finally {
      setLoading(false);
    }
  }

  // Quick toggle from the card (uses personal scope by default)
  async function handleQuickToggle(tool: Tool, enabled: boolean) {
    try {
      const res = await fetch(`/api/tools/${tool.id}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          is_enabled: enabled,
          scope: 'personal',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to toggle tool');
      }

      console.log('[Tools] Tool toggled successfully');
      await loadTools();
    } catch (e: any) {
      console.error('[Tools] Failed to toggle tool:', e);
      throw e;
    }
  }

  const stats = {
    total: tools.length,
    active: tools.filter(t => t.is_active).length,
    builtin: tools.filter(t => t.is_builtin).length,
    custom: tools.filter(t => !t.is_builtin).length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Tools</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure and manage available tools including search providers and API integrations.
          </p>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          <div className="font-medium">Failed to load tools</div>
          <div className="text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total tools</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {stats.total}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Active tools</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {stats.active}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Built-in tools</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {stats.builtin}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">Custom tools</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {stats.custom}
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-blue-600 dark:text-blue-400 mt-0.5">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              About Tool Configuration
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Click "Configure" on any tool to set up API keys and enable/disable providers. 
            </p>
          </div>
        </div>
      </div>

      {/* Tool list */}
      <ToolList 
        tools={tools} 
        onToggleEnabled={handleQuickToggle}
        isLoading={loading} 
      />
    </div>
  );
}
