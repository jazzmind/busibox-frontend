'use client';
/**
 * Agent Selection Panel Component
 * 
 * Side panel for selecting agents with search and filtering capabilities.
 * Similar to the insights panel design.
 */


import { useState, useMemo } from 'react';
import { Bot, Check, X, Search } from 'lucide-react';

export interface Agent {
  id: string;
  name: string;
  description: string;
  icon?: string;
  enabled?: boolean;
  capabilities?: string[];
}

interface AgentSelectionPanelProps {
  selectedAgents: string[];
  onAgentsChange: (agentIds: string[]) => void;
  availableAgents: Agent[];
  onClose: () => void;
}

export function AgentSelectionPanel({
  selectedAgents,
  onAgentsChange,
  availableAgents,
  onClose,
}: AgentSelectionPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter agents based on search query
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return availableAgents;
    
    const query = searchQuery.toLowerCase();
    return availableAgents.filter(agent => 
      agent.name.toLowerCase().includes(query) ||
      agent.description.toLowerCase().includes(query) ||
      agent.capabilities?.some(cap => cap.toLowerCase().includes(query))
    );
  }, [availableAgents, searchQuery]);

  const handleToggleAgent = (agentId: string) => {
    if (selectedAgents.includes(agentId)) {
      onAgentsChange(selectedAgents.filter(id => id !== agentId));
    } else {
      onAgentsChange([...selectedAgents, agentId]);
    }
  };

  const handleSelectAll = () => {
    onAgentsChange(filteredAgents.map(a => a.id));
  };

  const handleClearAll = () => {
    onAgentsChange([]);
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Select Agents
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Stats and Actions */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {selectedAgents.length} of {availableAgents.length} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Select all
            </button>
            {selectedAgents.length > 0 && (
              <>
                <span className="text-gray-400">|</span>
                <button
                  onClick={handleClearAll}
                  className="text-gray-600 dark:text-gray-400 hover:underline"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredAgents.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <Bot className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">
              {searchQuery ? 'No agents match your search' : 'No agents available'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredAgents.map((agent) => {
              const isSelected = selectedAgents.includes(agent.id);
              
              return (
                <button
                  key={agent.id}
                  onClick={() => handleToggleAgent(agent.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isSelected ? (
                      <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-500 rounded" />
                    )}
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {agent.icon && <span className="text-lg">{agent.icon}</span>}
                      <span className={`font-medium ${
                        isSelected 
                          ? 'text-blue-900 dark:text-blue-100' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {agent.name}
                      </span>
                    </div>
                    <p className={`text-xs mb-1 ${
                      isSelected 
                        ? 'text-blue-700 dark:text-blue-300' 
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {agent.description}
                    </p>
                    {agent.capabilities && agent.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              isSelected
                                ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          💡 <strong>Tip:</strong> The system will intelligently route your query to the most appropriate agent(s) from your selection.
        </p>
      </div>
    </div>
  );
}

