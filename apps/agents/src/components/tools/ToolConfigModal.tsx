/**
 * ToolConfigModal Component
 * 
 * Modal for configuring tool settings like API keys, provider activation,
 * and scoped settings (global, agent-specific, or personal).
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Tool, Agent } from '@/lib/types';
import { Globe, Users, User, Bot, Check, X, ChevronDown } from 'lucide-react';

export type ConfigScope = 'global' | 'agent' | 'personal';

export interface ToolConfig {
  providers?: {
    [key: string]: {
      enabled: boolean;
      api_key?: string;
      api_url?: string;
      [key: string]: any;
    };
  };
  settings?: {
    [key: string]: any;
  };
  scope?: ConfigScope;
  agent_ids?: string[]; // For agent scope - which agents this config applies to
  is_enabled?: boolean; // Whether the tool is enabled at this scope
}

interface ToolConfigModalProps {
  tool: Tool | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (toolId: string, config: ToolConfig) => Promise<void>;
  onToggleEnabled?: (toolId: string, enabled: boolean, scope: ConfigScope, agentIds?: string[]) => Promise<void>;
  isAdmin?: boolean; // If true, enables global-level config
}

// Define provider configurations for different tool types
const PROVIDER_CONFIGS: Record<string, { name: string; displayName: string; requiresApiKey: boolean; fields: string[] }[]> = {
  web_search: [
    { name: 'duckduckgo', displayName: 'DuckDuckGo', requiresApiKey: false, fields: [] },
    { name: 'perplexity', displayName: 'Perplexity', requiresApiKey: true, fields: ['api_key'] },
    { name: 'tavily', displayName: 'Tavily', requiresApiKey: true, fields: ['api_key'] },
    { name: 'brave', displayName: 'Brave Search', requiresApiKey: true, fields: ['api_key'] },
  ],
};

const SCOPE_INFO: Record<ConfigScope, { label: string; description: string; icon: React.ReactNode }> = {
  global: {
    label: 'Global',
    description: 'Default for all users',
    icon: <Globe className="w-4 h-4" />,
  },
  agent: {
    label: 'Agent',
    description: 'Applies to selected agents',
    icon: <Bot className="w-4 h-4" />,
  },
  personal: {
    label: 'Personal',
    description: 'Only affects your account',
    icon: <User className="w-4 h-4" />,
  },
};

export function ToolConfigModal({ 
  tool, 
  isOpen, 
  onClose, 
  onSave, 
  onToggleEnabled,
  isAdmin = false,
}: ToolConfigModalProps) {
  const [config, setConfig] = useState<ToolConfig>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<ConfigScope>('personal');
  const [loadedScope, setLoadedScope] = useState<ConfigScope>('personal');
  const [isEnabled, setIsEnabled] = useState(true);
  
  // Agent selection for agent scope
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);

  // Track if we're currently loading to prevent loops
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Load existing configuration when tool changes or modal opens
  useEffect(() => {
    if (tool && isOpen) {
      setIsInitialLoad(true);
      loadConfig();
      loadAgents();
    }
  }, [tool?.id, isOpen]);

  // Reload config when scope changes (but not on initial load or when selectedAgentIds changes from loadConfig)
  useEffect(() => {
    // Skip the initial load - that's handled above
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    if (tool && isOpen) {
      loadConfig();
    }
  }, [scope]); // Only trigger on scope change, not selectedAgentIds

  async function loadAgents() {
    setAgentsLoading(true);
    try {
      const res = await fetch('/api/agents', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to load agents:', e);
    } finally {
      setAgentsLoading(false);
    }
  }

  async function loadConfig() {
    if (!tool) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Build query params for scope lookup
      const params = new URLSearchParams({ scope });
      if (scope === 'agent' && selectedAgentIds.length > 0) {
        params.set('agent_ids', selectedAgentIds.join(','));
      }
      
      const res = await fetch(`/api/tools/${tool.id}/config?${params}`, {
        credentials: 'include',
      });
      
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setIsEnabled(data.is_enabled !== false);
        setLoadedScope(data.scope || scope);
        // Only set agent_ids on initial load to prevent loops
        if (data.agent_ids && isInitialLoad) {
          setSelectedAgentIds(data.agent_ids);
        }
      } else {
        // If no config exists, initialize with defaults
        const providers = getProvidersForTool(tool);
        const defaultConfig: ToolConfig = {
          providers: {},
          is_enabled: true,
        };
        
        providers.forEach(p => {
          if (defaultConfig.providers) {
            defaultConfig.providers[p.name] = {
              enabled: !p.requiresApiKey, // Enable free providers by default
            };
          }
        });
        
        setConfig(defaultConfig);
        setIsEnabled(true);
        setLoadedScope(scope);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }

  function getProvidersForTool(tool: Tool) {
    // Check tool name to determine which providers to show
    if (tool.name.toLowerCase().includes('search') || tool.entrypoint.includes('web_search')) {
      return PROVIDER_CONFIGS.web_search || [];
    }
    return [];
  }

  async function handleSave() {
    if (!tool) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Include scope and agent_ids in the config
      const configToSave: ToolConfig = {
        ...config,
        scope,
        agent_ids: scope === 'agent' ? selectedAgentIds : undefined,
        is_enabled: isEnabled,
      };
      await onSave(tool.id, configToSave);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleEnabled() {
    if (!tool || !onToggleEnabled) return;
    
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    
    try {
      await onToggleEnabled(
        tool.id, 
        newEnabled, 
        scope, 
        scope === 'agent' ? selectedAgentIds : undefined
      );
    } catch (e: any) {
      // Revert on error
      setIsEnabled(!newEnabled);
      setError(e.message || 'Failed to toggle tool');
    }
  }

  function updateProviderConfig(provider: string, field: string, value: any) {
    setConfig(prev => {
      const currentProvider = prev.providers?.[provider] || { enabled: false };
      const updatedProvider = {
        ...currentProvider,
        [field]: value,
        enabled: field === 'enabled' ? Boolean(value) : (currentProvider.enabled ?? false),
      };
      
      return {
        ...prev,
        providers: {
          ...prev.providers,
          [provider]: updatedProvider,
        },
      };
    });
  }

  function toggleAgentSelection(agentId: string) {
    setSelectedAgentIds(prev => 
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  }

  if (!isOpen || !tool) return null;

  const providers = getProvidersForTool(tool);
  const availableScopes: ConfigScope[] = isAdmin 
    ? ['global', 'agent', 'personal'] 
    : ['agent', 'personal'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Configure {tool.name}
              </h2>
              {tool.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {tool.description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Tool Status
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {isEnabled ? 'This tool is enabled and available for use' : 'This tool is disabled'}
                  </p>
                </div>
                <button
                  onClick={handleToggleEnabled}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Scope Selector */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Configuration Scope
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {availableScopes.map((s) => {
                    const info = SCOPE_INFO[s];
                    const isSelected = scope === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setScope(s)}
                        className={`flex items-center gap-3 px-4 py-3 text-sm rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500 ring-opacity-50'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className={isSelected ? 'text-blue-600 dark:text-blue-400' : ''}>
                          {info.icon}
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{info.label}</div>
                          <div className="text-xs opacity-75">{info.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                {loadedScope !== scope && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ No config at this level. Showing inherited from {SCOPE_INFO[loadedScope].label.toLowerCase()} level.
                  </p>
                )}
              </div>

              {/* Agent Selector (for agent scope) */}
              {scope === 'agent' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Select Agents
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Choose which agents will use this configuration. Leave empty to apply to all your agents.
                  </p>
                  
                  {/* Agent selector dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                      className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-left text-sm"
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        {selectedAgentIds.length === 0 
                          ? 'All agents (default)'
                          : `${selectedAgentIds.length} agent${selectedAgentIds.length > 1 ? 's' : ''} selected`}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${agentDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {agentDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {agentsLoading ? (
                          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                            Loading agents...
                          </div>
                        ) : agents.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                            No agents found
                          </div>
                        ) : (
                          <>
                            {/* Clear selection option */}
                            <button
                              onClick={() => setSelectedAgentIds([])}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                selectedAgentIds.length === 0 ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                selectedAgentIds.length === 0 
                                  ? 'bg-blue-600 border-blue-600' 
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {selectedAgentIds.length === 0 && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-gray-700 dark:text-gray-300">All agents (default)</span>
                            </button>
                            
                            <div className="border-t border-gray-200 dark:border-gray-700" />
                            
                            {agents.map((agent) => {
                              const isSelected = selectedAgentIds.includes(agent.id);
                              return (
                                <button
                                  key={agent.id}
                                  onClick={() => toggleAgentSelection(agent.id)}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                    isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                    isSelected 
                                      ? 'bg-blue-600 border-blue-600' 
                                      : 'border-gray-300 dark:border-gray-600'
                                  }`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                      {agent.display_name || agent.name}
                                    </div>
                                    {agent.description && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {agent.description}
                                      </div>
                                    )}
                                  </div>
                                  {agent.is_builtin && (
                                    <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                      Built-in
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Selected agents chips */}
                  {selectedAgentIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {selectedAgentIds.map(id => {
                        const agent = agents.find(a => a.id === id);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                          >
                            <Bot className="w-3 h-3" />
                            {agent?.display_name || agent?.name || id}
                            <button
                              onClick={() => toggleAgentSelection(id)}
                              className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Provider Configuration */}
              {providers.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Search Providers
                  </h3>
                  <div className="space-y-3">
                    {providers.map(provider => {
                      const providerConfig = config.providers?.[provider.name] || { enabled: false };
                      
                      return (
                        <div
                          key={provider.name}
                          className={`border rounded-lg transition-colors ${
                            providerConfig.enabled 
                              ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10' 
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-3 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={providerConfig.enabled || false}
                                  onChange={(e) => updateProviderConfig(provider.name, 'enabled', e.target.checked)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {provider.displayName}
                                </span>
                              </label>
                              {!provider.requiresApiKey && (
                                <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                                  Free
                                </span>
                              )}
                            </div>
                            
                            {provider.requiresApiKey && providerConfig.enabled && (
                              <div className="mt-3 pl-7">
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                  API Key
                                </label>
                                <input
                                  type="password"
                                  value={providerConfig.api_key || ''}
                                  onChange={(e) => updateProviderConfig(provider.name, 'api_key', e.target.value)}
                                  placeholder={`Enter ${provider.displayName} API key`}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      <strong>Tip:</strong> When multiple providers are enabled, searches run in parallel and results are merged for more comprehensive results.
                    </p>
                  </div>
                </div>
              )}

              {providers.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No configurable provider options for this tool.</p>
                  <p className="text-sm mt-1">You can still enable/disable the tool above.</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            )}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
