/**
 * ToolList Component
 * 
 * Grid/list view of tools with filtering and sorting
 */

'use client';

import React, { useState } from 'react';
import { Tool } from '@/lib/types';
import { ToolCard } from './ToolCard';

interface ToolListProps {
  tools: Tool[];
  onConfigure?: (tool: Tool) => void;
  onToggleEnabled?: (tool: Tool, enabled: boolean) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export function ToolList({
  tools,
  onConfigure,
  onToggleEnabled,
  isLoading = false,
  className = '',
}: ToolListProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'builtin' | 'custom'>('all');
  const [search, setSearch] = useState('');

  // Filter tools
  const filteredTools = tools.filter(tool => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        tool.name.toLowerCase().includes(searchLower) ||
        tool.description?.toLowerCase().includes(searchLower) ||
        tool.entrypoint.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filter === 'active' && !tool.is_active) return false;
    if (filter === 'inactive' && tool.is_active) return false;
    if (filter === 'builtin' && !tool.is_builtin) return false;
    if (filter === 'custom' && tool.is_builtin) return false;

    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          {(['all', 'active', 'inactive', 'builtin', 'custom'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                filter === f
                  ? 'bg-blue-600 dark:bg-blue-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Tool count */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredTools.length} of {tools.length} tools
      </div>

      {/* Tool grid */}
      {filteredTools.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">No tools found</p>
          <p className="text-sm">Try adjusting your filters or search query</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onConfigure={onConfigure}
              onToggleEnabled={onToggleEnabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
