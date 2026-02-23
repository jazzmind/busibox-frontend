'use client';

import React from 'react';

export interface AgentToolOption {
  id: string;
  name: string;
  description: string;
  icon?: string;
  enabled?: boolean;
}

export interface AgentToolsSelectorProps {
  availableTools: AgentToolOption[];
  selectedTools: string[];
  onToolsChange: (toolIds: string[]) => void;
  disabled?: boolean;
}

export function AgentToolsSelector({
  availableTools,
  selectedTools,
  onToolsChange,
  disabled = false,
}: AgentToolsSelectorProps) {
  const enabledTools = availableTools.filter((t) => t.enabled !== false);

  const toggle = (toolId: string) => {
    if (selectedTools.includes(toolId)) {
      onToolsChange(selectedTools.filter((id) => id !== toolId));
    } else {
      onToolsChange([...selectedTools, toolId]);
    }
  };

  const selectAll = () => {
    onToolsChange(enabledTools.map((t) => t.id));
  };

  const clearAll = () => {
    onToolsChange([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {selectedTools.length} of {enabledTools.length} selected
        </span>
        {!disabled && enabledTools.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {enabledTools.map((tool) => {
          const selected = selectedTools.includes(tool.id);
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => !disabled && toggle(tool.id)}
              disabled={disabled}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
                selected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl">
                {tool.icon ?? '🔧'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {tool.name}
                </div>
                {tool.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                    {tool.description}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selected
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {selected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {enabledTools.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
          No tools available. Tools are loaded from the agent API.
        </p>
      )}
    </div>
  );
}
