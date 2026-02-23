/**
 * Agent & Tool Selector Component
 * 
 * Replaces the ModelSelector. Instead of selecting which model to use,
 * users select which agents and tools the dispatcher should consider.
 * The agents themselves decide which models to use.
 */

'use client';

import { useState } from 'react';
import { Bot, Wrench, ChevronDown, Check, X } from 'lucide-react';
import type { AgentDefinition, ToolDefinition } from '../../lib/agent/agent-service-client';

export interface AgentToolSelectorProps {
  availableAgents: AgentDefinition[];
  availableTools: ToolDefinition[];
  selectedAgents: string[];
  selectedTools: string[];
  onAgentsChange: (agents: string[]) => void;
  onToolsChange: (tools: string[]) => void;
  disabled?: boolean;
}

export function AgentToolSelector({
  availableAgents,
  availableTools,
  selectedAgents,
  selectedTools,
  onAgentsChange,
  onToolsChange,
  disabled = false,
}: AgentToolSelectorProps) {
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [toolDropdownOpen, setToolDropdownOpen] = useState(false);

  const toggleAgent = (agentName: string) => {
    if (selectedAgents.includes(agentName)) {
      onAgentsChange(selectedAgents.filter(a => a !== agentName));
    } else {
      onAgentsChange([...selectedAgents, agentName]);
    }
  };

  const toggleTool = (toolName: string) => {
    if (selectedTools.includes(toolName)) {
      onToolsChange(selectedTools.filter(t => t !== toolName));
    } else {
      onToolsChange([...selectedTools, toolName]);
    }
  };

  const selectAllAgents = () => {
    onAgentsChange(availableAgents.filter(a => a.is_active).map(a => a.name));
  };

  const clearAgents = () => {
    onAgentsChange([]);
  };

  const selectAllTools = () => {
    onToolsChange(availableTools.filter(t => t.enabled).map(t => t.name));
  };

  const clearTools = () => {
    onToolsChange([]);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Agents Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setAgentDropdownOpen(!agentDropdownOpen);
            setToolDropdownOpen(false);
          }}
          disabled={disabled}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
            disabled
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span className="text-sm font-medium">
            Agents ({selectedAgents.length}/{availableAgents.length})
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${agentDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {agentDropdownOpen && (
          <div className="absolute z-50 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            {/* Header with select/clear all */}
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Available Agents
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllAgents}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  All
                </button>
                <button
                  onClick={clearAgents}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Agent list */}
            <div className="max-h-64 overflow-y-auto py-1">
              {availableAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent.name)}
                  className={`w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    !agent.is_active ? 'opacity-50' : ''
                  }`}
                  disabled={!agent.is_active}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${
                    selectedAgents.includes(agent.name)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedAgents.includes(agent.name) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {agent.display_name}
                      {agent.is_builtin && (
                        <span className="ml-2 text-xs text-gray-400">(built-in)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {agent.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setAgentDropdownOpen(false)}
                className="w-full px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tools Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setToolDropdownOpen(!toolDropdownOpen);
            setAgentDropdownOpen(false);
          }}
          disabled={disabled}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
            disabled
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span className="text-sm font-medium">
            Tools ({selectedTools.length}/{availableTools.length})
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${toolDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {toolDropdownOpen && (
          <div className="absolute z-50 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            {/* Header with select/clear all */}
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Available Tools
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllTools}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  All
                </button>
                <button
                  onClick={clearTools}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Tool list */}
            <div className="py-1">
              {availableTools.map((tool) => (
                <button
                  key={tool.name}
                  onClick={() => toggleTool(tool.name)}
                  className={`w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    !tool.enabled ? 'opacity-50' : ''
                  }`}
                  disabled={!tool.enabled}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${
                    selectedTools.includes(tool.name)
                      ? 'bg-green-600 border-green-600'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedTools.includes(tool.name) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {tool.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {tool.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setToolDropdownOpen(false)}
                className="w-full px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected summary pills */}
      <div className="flex flex-wrap gap-1">
        {selectedAgents.length > 0 && selectedAgents.length <= 3 && (
          selectedAgents.map(name => {
            const agent = availableAgents.find(a => a.name === name);
            return (
              <span
                key={name}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full"
              >
                {agent?.display_name || name}
                <button
                  onClick={() => toggleAgent(name)}
                  className="hover:text-blue-900 dark:hover:text-blue-100"
                  disabled={disabled}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })
        )}
        {selectedTools.length > 0 && selectedTools.length <= 3 && (
          selectedTools.map(name => (
            <span
              key={name}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full"
            >
              {name.replace(/_/g, ' ')}
              <button
                onClick={() => toggleTool(name)}
                className="hover:text-green-900 dark:hover:text-green-100"
                disabled={disabled}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}


