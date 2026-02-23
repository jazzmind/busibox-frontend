/**
 * AgentCard Component
 * 
 * Card display for an agent in list view with:
 * - Agent name and description
 * - Status indicator (active/inactive)
 * - Model and tool count
 * - Quick actions (view, edit, test, delete)
 */

'use client';

import React from 'react';
import { Agent } from '@/lib/types';
import Link from 'next/link';
import { formatDate } from '@jazzmind/busibox-app/lib/date-utils';

interface AgentCardProps {
  agent: Agent;
  onTest?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
  className?: string;
}

export function AgentCard({ agent, onTest, onDelete, className = '' }: AgentCardProps) {
  // Get actual tool count from tools.names array
  const toolCount = agent.tools?.names?.length || 0;
  const isPersonal = agent.is_personal;
  const isBuiltin = agent.is_builtin;

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-md transition-shadow ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {agent.display_name || agent.name}
            </h3>
            
            {/* Status badge */}
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              agent.is_active 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {agent.is_active ? 'Active' : 'Inactive'}
            </span>

            {/* Type badges */}
            {isBuiltin && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                Built-in
              </span>
            )}
            {isPersonal && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                Personal
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {agent.description || 'No description'}
          </p>

          {/* Metadata */}
          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Model: {agent.model}</span>
            <span>Tools: {toolCount}</span>
            {agent.workflow && <span>Has Workflow</span>}
            <span>v{agent.version}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          <Link
            href={`/agent/${agent.id}?tab=details`}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View details"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Link>

          {!isBuiltin && (
            <Link
              href={`/agent/${agent.id}/edit`}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
              title="Edit agent"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Link>
          )}

          <Link
            href={`/agent/${agent.id}?chat=true`}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
            title="Test agent"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </Link>

          {!isBuiltin && onDelete && (
            <button
              onClick={() => {
                if (confirm(`Delete agent "${agent.display_name || agent.name}"?`)) {
                  onDelete(agent);
                }
              }}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="Delete agent"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Scopes */}
      {agent.scopes && agent.scopes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Required Scopes:</div>
          <div className="flex flex-wrap gap-1">
            {agent.scopes.map((scope) => (
              <span
                key={scope}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timestamps - only show for non-builtin agents */}
      {!isBuiltin && agent.updated_at && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
          <div>Updated: {formatDate(agent.updated_at)}</div>
        </div>
      )}
    </div>
  );
}
