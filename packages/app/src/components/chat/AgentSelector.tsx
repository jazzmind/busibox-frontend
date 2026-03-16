'use client';
/**
 * Agent Selector Component
 * 
 * Allows selecting from available agents (weather, researcher, etc.)
 * with a dropdown checkbox interface.
 */


import { useState, useEffect, useRef } from 'react';
import { Bot, Check } from 'lucide-react';

export interface Agent {
  id: string;
  name: string;
  description: string;
  icon?: string;
  enabled?: boolean;
  capabilities?: string[];
}

interface AgentSelectorProps {
  selectedAgents: string[];
  onAgentsChange: (agentIds: string[]) => void;
  disabled?: boolean;
  availableAgents?: Agent[];
}

const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'weather_agent',
    name: 'Weather Agent',
    description: 'Get current weather and forecasts',
    icon: '🌤️',
    enabled: true,
    capabilities: ['weather', 'forecasts', 'climate'],
  },
  {
    id: 'researcher_agent',
    name: 'Research Agent',
    description: 'Deep research with web and document search',
    icon: '🔬',
    enabled: true,
    capabilities: ['research', 'analysis', 'synthesis'],
  },
  {
    id: 'code_agent',
    name: 'Code Agent',
    description: 'Code generation and analysis',
    icon: '💻',
    enabled: true,
    capabilities: ['coding', 'debugging', 'review'],
  },
  {
    id: 'data_agent',
    name: 'Data Agent',
    description: 'Data analysis and visualization',
    icon: '📊',
    enabled: false,
    capabilities: ['analysis', 'visualization', 'statistics'],
  },
];

export function AgentSelector({
  selectedAgents,
  onAgentsChange,
  disabled = false,
  availableAgents = DEFAULT_AGENTS,
}: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggleAgent = (agentId: string) => {
    if (selectedAgents.includes(agentId)) {
      onAgentsChange(selectedAgents.filter((id) => id !== agentId));
    } else {
      onAgentsChange([...selectedAgents, agentId]);
    }
  };

  const enabledAgents = availableAgents.filter((a) => a.enabled !== false);
  const selectedCount = selectedAgents.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
          disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : selectedCount > 0
            ? 'bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        title="Select agents"
      >
        <Bot className="w-4 h-4" />
        <span className="font-medium">
          Agents {selectedCount > 0 && `(${selectedCount})`}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2 border-b border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">
              Available Agents
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {enabledAgents.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No agents available
              </div>
            ) : (
              <div className="p-1">
                {enabledAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleToggleAgent(agent.id)}
                    className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {selectedAgents.includes(agent.id) ? (
                        <div className="w-5 h-5 bg-purple-600 rounded flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {agent.icon && <span className="text-lg">{agent.icon}</span>}
                        <span className="font-medium text-gray-900">{agent.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{agent.description}</p>
                      {agent.capabilities && agent.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agent.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedCount > 0 && (
            <div className="p-2 border-t border-gray-200">
              <button
                onClick={() => onAgentsChange([])}
                className="w-full px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

