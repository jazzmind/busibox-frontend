/**
 * ToolConfigPanel Component
 * 
 * Panel for configuring tool settings like API keys, provider activation,
 * and scoped settings (global, agent-specific, or personal).
 * 
 * This is the non-modal version for use as a tab in the tool detail page.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Tool, Agent } from '@/lib/types';
import { Globe, User, Bot, Check, X, ChevronDown, Save, Loader2, Trash2 } from 'lucide-react';

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
  agent_ids?: string[];
  is_enabled?: boolean;
}

interface ToolConfigPanelProps {
  tool: Tool;
  isAdmin?: boolean;
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

export function ToolConfigPanel({ tool, isAdmin = false }: ToolConfigPanelProps) {
  const [config, setConfig] = useState<ToolConfig>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Default to global scope if admin, otherwise agent scope
  const [scope, setScope] = useState<ConfigScope>(isAdmin ? 'global' : 'agent');
  const [loadedScope, setLoadedScope] = useState<ConfigScope>(isAdmin ? 'global' : 'agent');
  const [isEnabled, setIsEnabled] = useState(true);
  const [hasOwnConfig, setHasOwnConfig] = useState(false); // Whether config exists at current scope
  
  // Agent selection for agent scope
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);

  // Track if we're currently loading to prevent loops
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Load existing configuration when tool changes
  useEffect(() => {
    if (tool) {
      setIsInitialLoad(true);
      // Reset scope to default when tool changes
      setScope(isAdmin ? 'global' : 'agent');
      loadConfig();
      loadAgents();
    }
  }, [tool?.id, isAdmin]);

  // Reload config when scope changes (but not on initial load)
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    if (tool) {
      loadConfig();
    }
  }, [scope]);

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
    setSuccess(null);
    
    try {
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
        // Check if config exists at the requested scope
        setHasOwnConfig(data.scope === scope);
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
              enabled: !p.requiresApiKey,
            };
          }
        });
        
        setConfig(defaultConfig);
        setIsEnabled(true);
        setLoadedScope(scope);
        setHasOwnConfig(false);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }

  function getProvidersForTool(tool: Tool) {
    // Only show providers for web_search, not document_search
    if (tool.name === 'web_search' || tool.entrypoint.includes('web_search')) {
      return PROVIDER_CONFIGS.web_search || [];
    }
    return [];
  }

  async function handleSave() {
    if (!tool) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const configToSave: ToolConfig = {
        ...config,
        scope,
        agent_ids: scope === 'agent' ? selectedAgentIds : undefined,
        is_enabled: isEnabled,
      };
      
      const res = await fetch(`/api/tools/${tool.id}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(configToSave),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save configuration');
      }
      
      setHasOwnConfig(true);
      setLoadedScope(scope);
      setSuccess('Configuration saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearConfig() {
    if (!tool) return;
    if (scope === 'global') {
      // Can't clear global config - it's the fallback
      setError('Cannot clear global configuration. It serves as the default for all users.');
      return;
    }
    
    const confirmMessage = scope === 'personal' 
      ? 'Clear your personal configuration? The agent or global settings will be used instead.'
      : 'Clear this agent configuration? The global settings will be used instead.';
    
    if (!confirm(confirmMessage)) return;
    
    setDeleting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const params = new URLSearchParams({ scope });
      if (scope === 'agent' && selectedAgentIds.length > 0) {
        params.set('agent_ids', selectedAgentIds.join(','));
      }
      
      const res = await fetch(`/api/tools/${tool.id}/config?${params}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to clear configuration');
      }
      
      setHasOwnConfig(false);
      setSuccess('Configuration cleared. Using inherited settings.');
      setTimeout(() => setSuccess(null), 3000);
      
      // Reload to show inherited config
      await loadConfig();
    } catch (e: any) {
      setError(e.message || 'Failed to clear configuration');
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleEnabled() {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
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

  const providers = getProvidersForTool(tool);
  const availableScopes: ConfigScope[] = isAdmin 
    ? ['global', 'agent', 'personal'] 
    : ['agent', 'personal'];

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* Enable/Disable Toggle */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
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
          </div>

          {/* Scope Selector */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
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
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Select Agents
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Choose which agents will use this configuration. Leave empty to apply to all your agents.
              </p>
              
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
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
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
                  <strong>Tip:</strong> When multiple providers are enabled, searches run in parallel and results are merged. Each provider returns up to the max results specified.
                </p>
              </div>
            </div>
          )}

          {providers.length === 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
              <p>No configurable provider options for this tool.</p>
              <p className="text-sm mt-1">You can still enable/disable the tool above.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            {/* Clear Config Button - only show for personal/agent scope when config exists */}
            <div>
              {scope !== 'global' && hasOwnConfig && (
                <button
                  onClick={handleClearConfig}
                  disabled={deleting}
                  className="px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {deleting ? 'Clearing...' : 'Clear & Use Inherited'}
                </button>
              )}
              {scope !== 'global' && !hasOwnConfig && loadedScope !== scope && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Using {SCOPE_INFO[loadedScope].label.toLowerCase()} settings
                </span>
              )}
            </div>
            
            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
