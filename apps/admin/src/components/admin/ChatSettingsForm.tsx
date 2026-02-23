'use client';

import { useState, useEffect } from 'react';
import { Button } from '@jazzmind/busibox-app';

interface SearchProviderConfig {
  id: string;
  provider: string;
  enabled: boolean;
  apiKey: string | null;
  endpoint: string | null;
  defaultProvider: boolean;
}

interface ChatSettingsFormProps {
  onSuccess?: () => void;
}

const PROVIDER_INFO = {
  tavily: {
    name: 'Tavily',
    description: 'AI-optimized search with clean, structured results. Recommended for AI applications.',
    apiKeyPlaceholder: 'tvly-xxxxxxxxxxxxx',
    endpointRequired: false as const,
  },
  serpapi: {
    name: 'SerpAPI',
    description: 'Access to Google search results with various search types.',
    apiKeyPlaceholder: 'your-serpapi-key',
    endpointRequired: false as const,
  },
  perplexity: {
    name: 'Perplexity',
    description: 'AI-powered search with natural language understanding.',
    apiKeyPlaceholder: 'pplx-xxxxxxxxxxxxx',
    endpointRequired: false as const,
  },
  bing: {
    name: 'Microsoft Bing',
    description: 'Bing Web Search API v7 for comprehensive web search.',
    apiKeyPlaceholder: 'your-bing-api-key',
    endpointRequired: true as const,
    endpointPlaceholder: 'https://api.bing.microsoft.com/v7.0/search',
  },
} as const;

export function ChatSettingsForm({ onSuccess }: ChatSettingsFormProps) {
  const [configs, setConfigs] = useState<SearchProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [loadingStreamingConfig, setLoadingStreamingConfig] = useState(true);
  const [savingStreamingConfig, setSavingStreamingConfig] = useState(false);

  useEffect(() => {
    fetchConfigs();
    fetchStreamingConfig();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/search-providers');
      const data = await response.json();
      
      if (response.ok) {
        // Initialize configs for all providers if they don't exist
        const existingProviders = new Set(data.data.configs.map((c: SearchProviderConfig) => c.provider));
        const allProviders = ['tavily', 'serpapi', 'perplexity', 'bing'];
        
        const initializedConfigs = allProviders.map(provider => {
          const existing = data.data.configs.find((c: SearchProviderConfig) => c.provider === provider);
          return existing || {
            id: '',
            provider,
            enabled: false,
            apiKey: null,
            endpoint: null,
            defaultProvider: false,
          };
        });
        
        setConfigs(initializedConfigs);
      } else {
        setError(data.error || 'Failed to load search provider configs');
      }
    } catch (err: any) {
      console.error('Error fetching configs:', err);
      setError(err.message || 'Failed to load search provider configs');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (provider: string, updates: Partial<SearchProviderConfig>) => {
    setSaving(provider);
    setError(null);
    setSuccess(false);

    try {
      const config = configs.find(c => c.provider === provider);
      const payload = {
        provider,
        enabled: updates.enabled ?? config?.enabled ?? false,
        apiKey: updates.apiKey !== undefined ? updates.apiKey : config?.apiKey,
        endpoint: updates.endpoint !== undefined ? updates.endpoint : config?.endpoint,
        defaultProvider: updates.defaultProvider ?? config?.defaultProvider ?? false,
      };

      const response = await fetch('/api/search-providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update config');
      }

      setSuccess(true);
      await fetchConfigs(); // Refresh configs
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error updating config:', err);
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleToggleEnabled = (provider: string, enabled: boolean) => {
    updateConfig(provider, { enabled });
  };

  const handleApiKeyChange = (provider: string, apiKey: string) => {
    setApiKeyInputs(prev => ({ ...prev, [provider]: apiKey }));
  };

  const handleApiKeySave = (provider: string) => {
    const apiKey = apiKeyInputs[provider];
    if (apiKey) {
      updateConfig(provider, { apiKey });
      setApiKeyInputs(prev => {
        const next = { ...prev };
        delete next[provider];
        return next;
      });
    }
  };

  const handleEndpointChange = (provider: string, endpoint: string) => {
    setConfigs(prev => prev.map(c => 
      c.provider === provider ? { ...c, endpoint } : c
    ));
  };

  const handleEndpointSave = (provider: string) => {
    const config = configs.find(c => c.provider === provider);
    if (config) {
      updateConfig(provider, { endpoint: config.endpoint || null });
    }
  };

  const handleSetDefault = (provider: string) => {
    updateConfig(provider, { defaultProvider: true });
  };

  const fetchStreamingConfig = async () => {
    try {
      const response = await fetch('/api/chat-config');
      if (response.ok) {
        const data = await response.json();
        setStreamingEnabled(data.data.config.streamingEnabled ?? true);
      }
    } catch (err) {
      console.error('Failed to load streaming config:', err);
    } finally {
      setLoadingStreamingConfig(false);
    }
  };

  const handleStreamingToggle = async (enabled: boolean) => {
    setSavingStreamingConfig(true);
    try {
      const response = await fetch('/api/chat-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamingEnabled: enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update streaming config');
      }

      setStreamingEnabled(enabled);
      setSuccess(true);
    } catch (err: any) {
      console.error('Error updating streaming config:', err);
      setError(err.message);
    } finally {
      setSavingStreamingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">Settings saved successfully!</p>
        </div>
      )}

      {/* Streaming Toggle */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Streaming Responses
            </h3>
            <p className="text-sm text-gray-600">
              Enable streaming for real-time AI responses. Disable for faster, complete responses.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {loadingStreamingConfig ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            ) : (
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={streamingEnabled}
                  onChange={(e) => handleStreamingToggle(e.target.checked)}
                  disabled={savingStreamingConfig}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  {streamingEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Search Providers */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Web Search Providers</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure web search providers for AI chat. Enable providers and provide API keys to allow users to search the web during conversations.
        </p>
      </div>

      {configs.map(config => {
        const info = PROVIDER_INFO[config.provider as keyof typeof PROVIDER_INFO];
        const isSaving = saving === config.provider;
        const hasApiKey = config.apiKey === '***'; // API returns '***' when key exists

        return (
          <div
            key={config.provider}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {info.name}
                  </h3>
                  {config.defaultProvider && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">{info.description}</p>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => handleToggleEnabled(config.provider, e.target.checked)}
                    disabled={isSaving}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    {config.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
            </div>

            {config.enabled && (
              <div className="space-y-4 pt-4 border-t border-gray-200">
                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key
                    {hasApiKey && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-green-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Configured
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                    <input
                      type="password"
                      value={apiKeyInputs[config.provider] || ''}
                      onChange={(e) => handleApiKeyChange(config.provider, e.target.value)}
                        placeholder={hasApiKey ? '••••••••••••••••' : info.apiKeyPlaceholder}
                        autoComplete="off"
                        data-1p-ignore
                        data-lpignore="true"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    </div>
                    <Button
                      type="button"
                      onClick={() => handleApiKeySave(config.provider)}
                      disabled={isSaving || !apiKeyInputs[config.provider]}
                      variant="primary"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                  {hasApiKey && !apiKeyInputs[config.provider] && (
                    <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      API key is configured. Enter a new key to update it.
                    </p>
                  )}
                </div>

                {/* Endpoint (for Bing) */}
                {info.endpointRequired && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Endpoint URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={config.endpoint || ''}
                        onChange={(e) => handleEndpointChange(config.provider, e.target.value)}
                        placeholder={info.endpointRequired ? (info as typeof PROVIDER_INFO.bing).endpointPlaceholder : ''}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <Button
                        type="button"
                        onClick={() => handleEndpointSave(config.provider)}
                        disabled={isSaving}
                        variant="primary"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Set as Default */}
                {!config.defaultProvider && (
                  <div>
                    <Button
                      type="button"
                      onClick={() => handleSetDefault(config.provider)}
                      disabled={isSaving}
                      variant="secondary"
                    >
                      Set as Default Provider
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

