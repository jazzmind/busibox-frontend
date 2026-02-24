/**
 * Tool Detail Page
 * 
 * View detailed information about a specific tool, configure it, and test it
 */

'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDate } from '@jazzmind/busibox-app/lib/date-utils';
import { Tool } from '@/lib/types';
import { ToolPlayground } from '@/components/tools/ToolPlayground';
import { ToolConfigPanel } from '@/components/tools/ToolConfigPanel';
import { Settings } from 'lucide-react';

type TabType = 'details' | 'configure' | 'test';

export default function ToolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  // Get active tab from URL or default to 'details'
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (tabParam === 'test') return 'test';
    if (tabParam === 'configure') return 'configure';
    return 'details';
  });

  // Sync tab with URL
  useEffect(() => {
    if (tabParam === 'test') {
      setActiveTab('test');
    } else if (tabParam === 'configure') {
      setActiveTab('configure');
    } else {
      setActiveTab('details');
    }
  }, [tabParam]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Use the resolved params to construct the correct path
    const basePath = `/tools/${resolvedParams.id}`;
    if (tab === 'details') {
      router.push(basePath);
    } else {
      router.push(`${basePath}?tab=${tab}`);
    }
  };

  useEffect(() => {
    loadTool();
    fetchToken();
  }, [resolvedParams.id]);

  async function fetchToken() {
    try {
      const res = await fetch('/api/auth/session', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
      }
    } catch (e) {
      console.error('[ToolDetail] Failed to fetch token:', e);
    }
  }

  async function loadTool() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tools');
      if (!res.ok) {
        throw new Error('Failed to load tools');
      }
      const tools = await res.json();
      const foundTool = tools.find((t: Tool) => t.id === resolvedParams.id);
      
      if (!foundTool) {
        throw new Error('Tool not found');
      }
      
      setTool(foundTool);
    } catch (e: any) {
      console.error('[ToolDetail] Failed to load tool:', e);
      setError(e?.message || 'Failed to load tool');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          <div className="font-medium">Error</div>
          <div className="text-sm mt-1">{error || 'Tool not found'}</div>
        </div>
        <button
          onClick={() => router.push('/tools')}
          className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          ← Back to tools
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/tools')}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2"
          >
            ← Back to tools
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{tool.name}</h1>
          {tool.description && (
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {tool.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tool.is_builtin && (
            <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
              Built-in
            </span>
          )}
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              tool.is_active
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            {tool.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6" aria-label="Tabs">
          <button
            onClick={() => handleTabChange('details')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => handleTabChange('configure')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'configure'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            Configure
          </button>
          <button
            onClick={() => handleTabChange('test')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'test'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Test
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <>
          {/* Details */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tool ID</h2>
              <p className="text-gray-900 dark:text-gray-100 font-mono text-sm">{tool.id}</p>
            </div>

            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Entrypoint</h2>
              <code className="text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-sm">
                {tool.entrypoint}
              </code>
            </div>

            {tool.scopes && tool.scopes.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Scopes</h2>
                <div className="flex flex-wrap gap-2">
                  {tool.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Version</h2>
                <p className="text-gray-900 dark:text-gray-100">{tool.version}</p>
              </div>
              <div>
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Created</h2>
                <p className="text-gray-900 dark:text-gray-100">
                  {formatDate(tool.created_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Schema */}
          {tool.schema && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Schema</h2>
              
              {/* Input Schema */}
              {tool.schema.input && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Input</h3>
                  <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
                    {JSON.stringify(tool.schema.input, null, 2)}
                  </pre>
                </div>
              )}

              {/* Output Schema */}
              {tool.schema.output && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Output</h3>
                  <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
                    {JSON.stringify(tool.schema.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'configure' && (
        <ToolConfigPanel tool={tool} isAdmin={true} />
      )}

      {activeTab === 'test' && (
        <ToolPlayground tool={tool} token={token || undefined} />
      )}
    </div>
  );
}
