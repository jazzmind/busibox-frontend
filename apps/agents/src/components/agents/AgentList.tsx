/**
 * AgentList Component
 * 
 * Grid/list view of agents with filtering and sorting
 */

'use client';

import React, { useState } from 'react';
import { Agent } from '@/lib/types';
import { AgentCard } from './AgentCard';

interface AgentListProps {
  agents: Agent[];
  onTest?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
  isLoading?: boolean;
  className?: string;
}

export function AgentList({
  agents,
  onTest,
  onDelete,
  isLoading = false,
  className = '',
}: AgentListProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'builtin' | 'personal'>('all');
  const [search, setSearch] = useState('');

  // Filter agents
  const filteredAgents = agents.filter(agent => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        agent.name.toLowerCase().includes(searchLower) ||
        agent.display_name?.toLowerCase().includes(searchLower) ||
        agent.description?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filter === 'active' && !agent.is_active) return false;
    if (filter === 'inactive' && agent.is_active) return false;
    if (filter === 'builtin' && !agent.is_builtin) return false;
    if (filter === 'personal' && !agent.is_personal) return false;

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
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          {(['all', 'active', 'inactive', 'builtin', 'personal'] as const).map((f) => (
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

      {/* Agent count */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredAgents.length} of {agents.length} agents
      </div>

      {/* Agent grid */}
      {filteredAgents.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">No agents found</p>
          <p className="text-sm">Try adjusting your filters or search query</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onTest={onTest}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
