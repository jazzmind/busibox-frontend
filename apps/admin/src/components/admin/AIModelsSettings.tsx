'use client';

import { useState, useEffect, useRef } from 'react';
import { useCustomization } from '@jazzmind/busibox-app';
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Cloud,
  Cpu,
  Send,
  ChevronDown,
  ChevronUp,
  Key,
  Activity,
  Zap,
  Eye,
  EyeOff,
  Settings,
  Plus,
  Check,
  Trash2,
  X,
  Shield,
  Mic,
  Volume2,
  ImageIcon,
} from 'lucide-react';
import { MediaServerStatus } from './MediaServerStatus';
import { VLLMServerStatus } from './VLLMServerStatus';
import { MediaPlaygroundSTT } from './MediaPlaygroundSTT';
import { MediaPlaygroundTTS } from './MediaPlaygroundTTS';
import { MediaPlaygroundImage } from './MediaPlaygroundImage';

// =============================================================================
// Types
// =============================================================================

interface ModelInfo {
  id: string;
  provider?: string;
  description?: string;
  purpose?: string;
  db_model?: boolean;
  model_id?: string;
  actual_model?: string;
}

interface ProviderKeyInfo {
  provider: string;
  configured: boolean;
  masked_key?: string;
}

interface HealthInfo {
  litellm: boolean;
  litellm_url: string;
  models_available: number;
  error?: string;
}

interface LLMServerInfo {
  name: string;
  port: number;
  running: boolean;
  healthy: boolean;
  model: string | null;
  memory_mb: number | null;
}

interface CompletionResult {
  model: string;
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  finish_reason?: string;
  raw?: Record<string, unknown>;
}

interface CloudModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  context_window?: number;
  registered: boolean;
}

interface CloudModelsData {
  provider: string;
  models: CloudModel[];
  api_key_configured: boolean;
  needs_key_resave?: boolean;
  provider_error?: string;
}

interface PurposesData {
  purposes: Record<string, string>;
  configurable_purposes: string[];
  available_models: Array<{
    model_name: string;
    actual_model: string;
    description: string;
  }>;
}

// =============================================================================
// Provider Config
// =============================================================================

const CLOUD_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT, sora and other OpenAI models',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Sonnet, Opus and Haiku',
    keyPlaceholder: 'sk-ant-...',
  },
] as const;

type BedrockAuthMode = 'iam' | 'api_key' | 'bedrock_api_key';

interface BedrockCredentials {
  authMode: BedrockAuthMode;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  apiKey: string; // Combined access_key:secret_key format
  bedrockApiKey: string; // Single Bedrock API Key (base64-encoded bearer token)
}

const PURPOSE_LABELS: Record<string, { label: string; description: string }> = {
  fast: { label: 'Fast', description: 'Quick responses, simple tasks' },
  agent: { label: 'Agent', description: 'Complex reasoning, tool use' },
  chat: { label: 'Chat', description: 'General conversation' },
  frontier: { label: 'Frontier', description: 'Best quality, complex analysis' },
  tool_calling: { label: 'Tool Calling', description: 'Function/tool invocations' },
  test: { label: 'Test', description: 'Validation and testing' },
  default: { label: 'Default', description: 'Fallback for unspecified purposes' },
  cleanup: { label: 'Cleanup', description: 'Text cleanup and formatting' },
  parsing: { label: 'Parsing', description: 'Document text extraction' },
  classify: { label: 'Classify', description: 'Document classification and routing' },
  video: { label: 'Video', description: 'Video generation (e.g. OpenAI Sora)' },
  image: { label: 'Image', description: 'Image generation (e.g. FLUX, DALL-E)' },
  transcribe: { label: 'Transcribe', description: 'Speech-to-text (e.g. Whisper)' },
  voice: { label: 'Voice', description: 'Text-to-speech (e.g. Kokoro, OpenAI TTS)' },
};

// =============================================================================
// Component
// =============================================================================

export function AIModelsSettings({ section = 'status' }: { section?: 'status' | 'mapping' | 'models' | 'playgrounds' }) {
  const { customization } = useCustomization();

  // State
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [providerKeys, setProviderKeys] = useState<ProviderKeyInfo[]>([]);
  const [purposes, setPurposes] = useState<PurposesData | null>(null);
  const [cloudModels, setCloudModels] = useState<Record<string, CloudModelsData>>({});
  const [loading, setLoading] = useState(true);

  // Streaming config
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [loadingStreamingConfig, setLoadingStreamingConfig] = useState(true);
  const [savingStreamingConfig, setSavingStreamingConfig] = useState(false);

  // Provider key inputs
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);

  // Bedrock credentials
  const [bedrockCreds, setBedrockCreds] = useState<BedrockCredentials>({
    authMode: 'bedrock_api_key',
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    apiKey: '',
    bedrockApiKey: '',
  });
  const [savingBedrock, setSavingBedrock] = useState(false);
  const [bedrockError, setBedrockError] = useState<string | null>(null);
  const [bedrockSuccess, setBedrockSuccess] = useState<string | null>(null);

  // Cloud model registration
  const [registeringModels, setRegisteringModels] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

  // Model deletion
  const [deletingModels, setDeletingModels] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Purpose mapping
  const [editingPurpose, setEditingPurpose] = useState<string | null>(null);
  const [purposeModelSelect, setPurposeModelSelect] = useState<string>('');
  const [savingPurpose, setSavingPurpose] = useState(false);

  // Media server status (for passing running state to playgrounds)
  const [mediaStatus, setMediaStatus] = useState<Record<string, { running: boolean; healthy: boolean }>>({});

  // LLM server status (core MLX-LM servers)
  const [llmServers, setLlmServers] = useState<LLMServerInfo[]>([]);
  const [totalLlmMemoryMb, setTotalLlmMemoryMb] = useState(0);

  // Media playground tab
  const [mediaTab, setMediaTab] = useState<'stt' | 'tts' | 'image'>('stt');

  // Active section is controlled by the settings page via the `section` prop
  const activeSection = section;

  // Playground state
  const [playgroundModel, setPlaygroundModel] = useState('agent');
  const [playgroundMessages, setPlaygroundMessages] = useState('');
  const [playgroundSystemPrompt, setPlaygroundSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | ''>('');
  const [playgroundResult, setPlaygroundResult] = useState<CompletionResult | null>(null);
  const [playgroundError, setPlaygroundError] = useState<string | null>(null);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundTime, setPlaygroundTime] = useState<number | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchHealth(),
      fetchModels(),
      fetchProviderKeys().then(() => {
        // Auto-fetch cloud models for configured providers
        // (done after keys are loaded so we know which are configured)
      }),
      fetchPurposes(),
      fetchStreamingConfig(),
      fetchMediaStatus(),
    ]);
    setLoading(false);
  };

  // Auto-fetch cloud models when provider keys are loaded and configured
  useEffect(() => {
    if (providerKeys.length === 0) return;
    const configuredProviders = providerKeys.filter(k => k.configured).map(k => k.provider);
    for (const provider of configuredProviders) {
      if (!cloudModels[provider]) {
        fetchCloudModels(provider);
      }
    }
  }, [providerKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/llm-health', { headers: { 'X-Quiet-Logs': '1' } });
      if (res.ok) {
        const data = await res.json();
        setHealth(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch LLM health:', e);
    }
  };

  const fetchMediaStatus = async () => {
    try {
      const res = await fetch('/api/media/status', { headers: { 'X-Quiet-Logs': '1' } });
      if (res.ok) {
        const data = await res.json();
        const payload = data.data ?? data;
        const servers = payload?.servers ?? {};
        const simplified: Record<string, { running: boolean; healthy: boolean }> = {};
        for (const [name, info] of Object.entries(servers)) {
          const s = info as { running: boolean; healthy: boolean };
          simplified[name] = { running: s.running, healthy: s.healthy };
        }
        setMediaStatus(simplified);

        const llm = (payload?.llm_servers ?? []) as LLMServerInfo[];
        setLlmServers(llm);
        setTotalLlmMemoryMb(payload?.total_llm_memory_mb ?? 0);
      }
    } catch {
      // non-MLX backends will 503 -- silently ignore
    }
  };

  const handleEnsureMediaServer = async (serverName: string) => {
    await fetch('/api/media/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server: serverName }),
    });
    await fetchMediaStatus();
  };

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/llm-models', { headers: { 'X-Quiet-Logs': '1' } });
      if (res.ok) {
        const data = await res.json();
        setModels(data.data?.models || []);
      }
    } catch (e) {
      console.error('Failed to fetch models:', e);
    }
  };

  const fetchProviderKeys = async () => {
    try {
      const res = await fetch('/api/llm-keys', { headers: { 'X-Quiet-Logs': '1' } });
      if (res.ok) {
        const data = await res.json();
        setProviderKeys(data.data?.providers || []);
      }
    } catch (e) {
      console.error('Failed to fetch provider keys:', e);
    }
  };

  const fetchPurposes = async () => {
    try {
      const res = await fetch('/api/llm-purposes', { headers: { 'X-Quiet-Logs': '1' } });
      if (res.ok) {
        const data = await res.json();
        setPurposes(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch purposes:', e);
    }
  };

  const fetchCloudModels = async (provider: string) => {
    try {
      const res = await fetch(`/api/llm-cloud-models?provider=${provider}`, {
        headers: { 'X-Quiet-Logs': '1' },
      });
      if (res.ok) {
        const data = await res.json();
        setCloudModels(prev => ({ ...prev, [provider]: data.data }));
      }
    } catch (e) {
      console.error(`Failed to fetch ${provider} cloud models:`, e);
    }
  };

  const fetchStreamingConfig = async () => {
    try {
      const res = await fetch('/api/chat-config', { headers: { 'X-Quiet-Logs': '1' } });
      if (res.ok) {
        const data = await res.json();
        setStreamingEnabled(data.data?.config?.streamingEnabled ?? true);
      }
    } catch (e) {
      console.error('Failed to fetch streaming config:', e);
    } finally {
      setLoadingStreamingConfig(false);
    }
  };

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleStreamingToggle = async (enabled: boolean) => {
    setSavingStreamingConfig(true);
    try {
      const res = await fetch('/api/chat-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamingEnabled: enabled }),
      });
      if (res.ok) setStreamingEnabled(enabled);
    } catch (e) {
      console.error('Error updating streaming config:', e);
    } finally {
      setSavingStreamingConfig(false);
    }
  };

  const handleSaveKey = async (provider: string) => {
    const apiKey = keyInputs[provider];
    if (!apiKey) return;

    setSavingKey(provider);
    setKeyError(null);
    setKeySuccess(null);

    try {
      const res = await fetch('/api/llm-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: apiKey }),
      });

      if (res.ok) {
        setKeySuccess(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key saved`);
        setKeyInputs(prev => ({ ...prev, [provider]: '' }));
        // Refresh keys and cloud models
        await Promise.all([fetchProviderKeys(), fetchCloudModels(provider)]);
        setTimeout(() => setKeySuccess(null), 5000);
      } else {
        const data = await res.json();
        setKeyError(data.error || `Failed to save ${provider} API key`);
      }
    } catch (e) {
      setKeyError(`Failed to save ${provider} API key`);
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveBedrockKey = async () => {
    setSavingBedrock(true);
    setBedrockError(null);
    setBedrockSuccess(null);

    try {
      let body: Record<string, string>;

      if (bedrockCreds.authMode === 'iam') {
        if (!bedrockCreds.accessKeyId || !bedrockCreds.secretAccessKey) {
          setBedrockError('Access Key ID and Secret Access Key are required');
          setSavingBedrock(false);
          return;
        }
        body = {
          provider: 'bedrock',
          aws_access_key_id: bedrockCreds.accessKeyId,
          aws_secret_access_key: bedrockCreds.secretAccessKey,
          aws_region: bedrockCreds.region || 'us-east-1',
        };
      } else if (bedrockCreds.authMode === 'bedrock_api_key') {
        if (!bedrockCreds.bedrockApiKey) {
          setBedrockError('Bedrock API Key is required');
          setSavingBedrock(false);
          return;
        }
        body = {
          provider: 'bedrock',
          api_key: bedrockCreds.bedrockApiKey,
          aws_region: bedrockCreds.region || 'us-east-1',
        };
      } else {
        if (!bedrockCreds.apiKey) {
          setBedrockError('API key is required');
          setSavingBedrock(false);
          return;
        }
        body = {
          provider: 'bedrock',
          api_key: bedrockCreds.apiKey,
          aws_region: bedrockCreds.region || 'us-east-1',
        };
      }

      const res = await fetch('/api/llm-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setBedrockSuccess('AWS Bedrock credentials configured successfully');
        setBedrockCreds(prev => ({
          ...prev,
          accessKeyId: '',
          secretAccessKey: '',
          apiKey: '',
          bedrockApiKey: '',
        }));
        await Promise.all([fetchProviderKeys(), fetchCloudModels('bedrock')]);
        setTimeout(() => setBedrockSuccess(null), 5000);
      } else {
        const data = await res.json();
        setBedrockError(data.error || 'Failed to save Bedrock credentials');
      }
    } catch {
      setBedrockError('Failed to save Bedrock credentials');
    } finally {
      setSavingBedrock(false);
    }
  };

  const handleRegisterModels = async (provider: string, modelIds: string[]) => {
    if (!modelIds.length) return;
    setRegisteringModels(true);
    setRegisterSuccess(null);

    try {
      const res = await fetch('/api/llm-cloud-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model_ids: modelIds }),
      });

      if (res.ok) {
        const data = await res.json();
        setRegisterSuccess(`Registered ${data.data?.registered || 0} model(s)`);
        await Promise.all([fetchModels(), fetchCloudModels(provider), fetchPurposes()]);
        setTimeout(() => setRegisterSuccess(null), 5000);
      }
    } catch (e) {
      console.error('Failed to register models:', e);
    } finally {
      setRegisteringModels(false);
    }
  };

  const handleRegisterAllUnregistered = async (provider: string) => {
    const data = cloudModels[provider];
    if (!data) return;
    const unregistered = data.models.filter(m => !m.registered).map(m => m.id);
    if (unregistered.length === 0) return;
    await handleRegisterModels(provider, unregistered);
  };

  const handleDeleteModel = async (modelId: string, modelName: string) => {
    if (!confirm(`Remove "${modelName}" from LiteLLM? This only removes DB-registered models.`)) return;

    setDeletingModels(prev => new Set(prev).add(modelId));
    setDeleteError(null);
    try {
      const res = await fetch('/api/llm-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', model_ids: [modelId] }),
      });
      if (res.ok) {
        // Refresh models list and purposes
        await Promise.all([fetchModels(), fetchPurposes()]);
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete model');
      }
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete model');
    } finally {
      setDeletingModels(prev => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
    }
  };

  const handleDeleteAllDbModels = async () => {
    const dbModels = models.filter(m => m.db_model && m.model_id);
    if (dbModels.length === 0) return;
    if (!confirm(`Remove all ${dbModels.length} DB-registered model(s) from LiteLLM?`)) return;

    const ids = dbModels.map(m => m.model_id!);
    setDeletingModels(new Set(ids));
    setDeleteError(null);
    try {
      const res = await fetch('/api/llm-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', model_ids: ids }),
      });
      if (res.ok) {
        await Promise.all([fetchModels(), fetchPurposes()]);
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete models');
      }
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete models');
    } finally {
      setDeletingModels(new Set());
    }
  };

  const handleSavePurpose = async (purpose: string, modelName: string) => {
    setSavingPurpose(true);
    try {
      const res = await fetch('/api/llm-purposes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, model_name: modelName }),
      });

      if (res.ok) {
        await fetchPurposes();
        setEditingPurpose(null);
        setPurposeModelSelect('');
      } else {
        const data = await res.json();
        console.error('Failed to update purpose:', data.error);
      }
    } catch (e) {
      console.error('Error updating purpose:', e);
    } finally {
      setSavingPurpose(false);
    }
  };

  const handlePlaygroundSend = async () => {
    if (!playgroundMessages.trim()) return;
    setPlaygroundLoading(true);
    setPlaygroundError(null);
    setPlaygroundResult(null);
    setPlaygroundTime(null);

    const messages: { role: string; content: string }[] = [];
    if (playgroundSystemPrompt.trim()) {
      messages.push({ role: 'system', content: playgroundSystemPrompt.trim() });
    }
    messages.push({ role: 'user', content: playgroundMessages.trim() });

    const startTime = Date.now();
    try {
      const body: Record<string, unknown> = { model: playgroundModel, messages, temperature };
      if (maxTokens !== '' && maxTokens > 0) body.max_tokens = maxTokens;

      const res = await fetch('/api/llm-completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const elapsed = Date.now() - startTime;
      setPlaygroundTime(elapsed);

      if (res.ok) {
        const data = await res.json();
        setPlaygroundResult(data.data);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
      } else {
        const data = await res.json();
        setPlaygroundError(data.error || 'Completion request failed');
      }
    } catch (e: unknown) {
      setPlaygroundTime(Date.now() - startTime);
      setPlaygroundError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setPlaygroundLoading(false);
    }
  };

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const allAvailableModels = purposes?.available_models || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: customization.primaryColor }} />
        <span className="ml-3 text-gray-600">Loading AI model settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Status ── */}
      {activeSection === 'status' && <>

      {/* Health Status Banner */}
      <div
        className="rounded-xl p-4 border"
        style={{
          backgroundColor: health?.litellm ? `${customization.primaryColor}10` : '#fef2f2',
          borderColor: health?.litellm ? `${customization.primaryColor}30` : '#fecaca',
        }}
      >
        <div className="flex items-center gap-3">
          <Activity className={`w-5 h-5 ${health?.litellm ? 'text-green-600' : 'text-red-500'}`} />
          <div>
            <h3 className="text-sm font-semibold" style={{ color: health?.litellm ? customization.primaryColor : '#991b1b' }}>
              LLM Service Status
            </h3>
            <p className="text-sm" style={{ color: health?.litellm ? customization.primaryColor : '#991b1b', opacity: 0.8 }}>
              {health?.litellm
                ? `Connected to LiteLLM - ${health.models_available} model(s) available`
                : health?.error
                  ? `LiteLLM not reachable: ${health.error}`
                  : 'LiteLLM service is not reachable'}
            </p>
          </div>
          <button onClick={fetchAll} className="ml-auto p-2 rounded-lg hover:bg-white/50 transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* LLM Core Servers */}
      {llmServers.length > 0 && (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-50">
            <Cpu className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">LLM Servers</h2>
            <p className="text-sm text-gray-500">
              Core MLX-LM model servers
              {totalLlmMemoryMb > 0 && ` — ${totalLlmMemoryMb >= 1024 ? `${(totalLlmMemoryMb / 1024).toFixed(1)} GB` : `${Math.round(totalLlmMemoryMb)} MB`} total`}
            </p>
          </div>
          <button onClick={fetchMediaStatus} className="ml-auto p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {llmServers.map(srv => {
            const memDisplay = srv.running && srv.memory_mb != null
              ? srv.memory_mb >= 1024
                ? `${(srv.memory_mb / 1024).toFixed(1)} GB`
                : `${Math.round(srv.memory_mb)} MB`
              : null;
            return (
              <div
                key={srv.name}
                className={`rounded-lg border p-4 ${
                  srv.running && srv.healthy
                    ? 'border-green-200 bg-green-50/50'
                    : srv.running
                      ? 'border-yellow-200 bg-yellow-50/50'
                      : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        srv.running && srv.healthy ? 'bg-green-500' : srv.running ? 'bg-yellow-500' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-900 capitalize">{srv.name}</span>
                    <span className="text-xs text-gray-400">:{srv.port}</span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    srv.running && srv.healthy
                      ? 'bg-green-100 text-green-700'
                      : srv.running
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {srv.running && srv.healthy ? 'Healthy' : srv.running ? 'Starting' : 'Stopped'}
                  </span>
                </div>
                {srv.model && (
                  <p className="text-xs text-gray-600 font-mono truncate mt-1" title={srv.model}>
                    {srv.model}
                  </p>
                )}
                {memDisplay && (
                  <p className="text-xs text-gray-500 mt-1">Memory: {memDisplay}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Media Servers Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-purple-50">
            <Activity className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Media Servers</h2>
            <p className="text-sm text-gray-500">Voice/TTS, transcription, and image generation server status and memory usage (MLX only)</p>
          </div>
        </div>
        <MediaServerStatus
          primaryColor={customization.primaryColor}
          onStatusChange={fetchMediaStatus}
        />
      </div>

      {/* vLLM GPU Servers Status (Proxmox) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-emerald-50">
            <Cpu className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">vLLM Servers</h2>
            <p className="text-sm text-gray-500">GPU model servers, VRAM usage, and on-demand media models (Proxmox only)</p>
          </div>
        </div>
        <VLLMServerStatus primaryColor={customization.primaryColor} />
      </div>

      </>}

      {/* ── Model Mapping ── */}
      {activeSection === 'mapping' && <>

      {/* Purpose Mapping */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-indigo-50">
            <Settings className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Model Purposes</h2>
            <p className="text-sm text-gray-500">Map purposes to specific models. Changing a purpose affects all services using it.</p>
          </div>
        </div>

        {purposes ? (
          <div className="space-y-2">
            {(purposes.configurable_purposes || []).map(purpose => {
              const currentModel = purposes.purposes[purpose] || '(not configured)';
              const info = PURPOSE_LABELS[purpose] || { label: purpose, description: '' };
              const isEditing = editingPurpose === purpose;

              return (
                <div key={purpose} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{info.label}</span>
                      <span className="text-xs text-gray-400">{info.description}</span>
                    </div>
                    {!isEditing && (
                      <span className="text-xs font-mono text-gray-600 truncate block">{currentModel}</span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={purposeModelSelect}
                        onChange={e => setPurposeModelSelect(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select model...</option>
                        {allAvailableModels.map(m => (
                          <option key={m.model_name} value={m.model_name}>
                            {m.model_name} ({m.actual_model ? m.actual_model.split('/').pop() : ''})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => purposeModelSelect && handleSavePurpose(purpose, purposeModelSelect)}
                        disabled={!purposeModelSelect || savingPurpose}
                        className="px-2 py-1 text-xs font-medium text-white rounded disabled:opacity-50"
                        style={{ backgroundColor: customization.primaryColor }}
                      >
                        {savingPurpose ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => { setEditingPurpose(null); setPurposeModelSelect(''); }}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingPurpose(purpose); setPurposeModelSelect(''); }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Change
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Purpose mapping not available. Check LiteLLM connection.</p>
        )}
      </div>

      </>}

      {/* ── Models & Providers ── */}
      {activeSection === 'models' && <>

      {/* Section 2: Registered Models */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-50">
            <Cpu className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Registered Models</h2>
            <p className="text-sm text-gray-500">All models currently available in LiteLLM</p>
          </div>
          {models.some(m => m.db_model) && (
            <button
              onClick={handleDeleteAllDbModels}
              disabled={deletingModels.size > 0}
              className="ml-auto text-xs font-medium text-red-600 hover:text-red-800 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove all DB models
            </button>
          )}
        </div>

        {deleteError && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-800">{deleteError}</p>
            <button onClick={() => setDeleteError(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-400 hover:text-red-600" />
            </button>
          </div>
        )}

        {models.length > 0 ? (
          <div className="space-y-1">
            {models.map(m => (
              <div key={`${m.id}-${m.model_id || ''}`} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm font-medium text-gray-900">{m.id}</span>
                  {m.actual_model && m.actual_model !== m.id && (
                    <span className="text-xs text-gray-400 truncate">{m.actual_model}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-gray-500 bg-white px-2 py-0.5 rounded border">
                    {m.provider || 'unknown'}
                  </span>
                  {m.db_model ? (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">DB</span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Config</span>
                  )}
                  {m.db_model && m.model_id && (
                    <button
                      onClick={() => handleDeleteModel(m.model_id!, m.id)}
                      disabled={deletingModels.has(m.model_id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Remove from LiteLLM"
                    >
                      {deletingModels.has(m.model_id) ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No models registered. Check LiteLLM configuration.</p>
        )}
      </div>

      {/* Section 3: Cloud Providers */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-purple-50">
            <Cloud className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cloud Providers</h2>
            <p className="text-sm text-gray-500">Configure API keys and enable cloud models</p>
          </div>
        </div>

        {keyError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-800">{keyError}</p>
          </div>
        )}
        {keySuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-800">{keySuccess}</p>
          </div>
        )}
        {registerSuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-800">{registerSuccess}</p>
          </div>
        )}

        <div className="space-y-6">
          {CLOUD_PROVIDERS.map(provider => {
            const keyInfo = providerKeys.find(k => k.provider === provider.id);
            const isSaving = savingKey === provider.id;
            const providerCloudData = cloudModels[provider.id];
            const hasKey = keyInfo?.configured || false;

            return (
              <div key={provider.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{provider.name}</h3>
                      {hasKey && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Key Set
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{provider.description}</p>
                  </div>
                </div>

                {/* API Key Input */}
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      value={keyInputs[provider.id] || ''}
                      onChange={e => setKeyInputs(prev => ({ ...prev, [provider.id]: e.target.value }))}
                      placeholder={hasKey ? 'Enter new key to update...' : provider.keyPlaceholder}
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => handleSaveKey(provider.id)}
                    disabled={isSaving || !keyInputs[provider.id]}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
                    style={{
                      backgroundColor: isSaving || !keyInputs[provider.id] ? '#9ca3af' : customization.primaryColor,
                    }}
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Key'}
                  </button>
                </div>

                {keyInfo?.configured && keyInfo.masked_key && (
                  <p className="mb-3 text-xs text-gray-500">
                    Current key: <span className="font-mono">{keyInfo.masked_key}</span>
                  </p>
                )}

                {/* Cloud Models Discovery */}
                {hasKey && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {!providerCloudData ? (
                      <button
                        onClick={() => fetchCloudModels(provider.id)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        Show available {provider.name} models
                      </button>
                    ) : providerCloudData.models.length === 0 ? (
                      <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                        {providerCloudData.needs_key_resave ? (
                          <>
                            <strong>API key needs to be re-saved.</strong> The key is stored in LiteLLM but is not accessible for listing models (this can happen after a service restart). Please re-enter and save your {provider.name} API key above to restore access.
                          </>
                        ) : providerCloudData.provider_error ? (
                          <>
                            {providerCloudData.provider_error}
                          </>
                        ) : (
                          <>
                            No models returned. If you just saved the key, click &quot;Refresh&quot; below to retry.
                          </>
                        )}
                        <button
                          onClick={() => fetchCloudModels(provider.id)}
                          className="ml-2 text-blue-600 hover:text-blue-800 font-medium underline"
                        >
                          Refresh
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-700">
                            Available Models ({providerCloudData.models.length})
                          </h4>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => fetchCloudModels(provider.id)}
                              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Refresh
                            </button>
                            {providerCloudData.models.some(m => !m.registered) && (
                              <button
                                onClick={() => handleRegisterAllUnregistered(provider.id)}
                                disabled={registeringModels}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                              >
                                {registeringModels ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Plus className="w-3 h-3" />
                                )}
                                Register all
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {providerCloudData.models.map(m => (
                            <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded">
                              <div className="min-w-0 flex-1 mr-2">
                                <span className="text-xs font-medium text-gray-900">{m.name}</span>
                                {m.name !== m.id && (
                                  <span className="text-xs text-gray-400 ml-2">{m.id}</span>
                                )}
                              </div>
                              {m.registered ? (
                                <span className="text-xs text-green-600 flex items-center gap-1 shrink-0">
                                  <Check className="w-3 h-3" /> Registered
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleRegisterModels(provider.id, [m.id])}
                                  disabled={registeringModels}
                                  className="text-xs font-medium text-blue-600 hover:text-blue-800 shrink-0"
                                >
                                  Register
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: AWS Bedrock */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-orange-50">
            <Shield className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">AWS Bedrock</h2>
              {providerKeys.find(k => k.provider === 'bedrock')?.configured && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  Configured
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Claude, Titan, Llama, Mistral and other models via Amazon Bedrock
            </p>
          </div>
        </div>

        {bedrockError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-800">{bedrockError}</p>
            <button onClick={() => setBedrockError(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-400 hover:text-red-600" />
            </button>
          </div>
        )}
        {bedrockSuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-800">{bedrockSuccess}</p>
          </div>
        )}

        {providerKeys.find(k => k.provider === 'bedrock')?.configured && providerKeys.find(k => k.provider === 'bedrock')?.masked_key && (
          <div className="mb-4 py-2 px-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">
              Current credentials: <span className="font-mono">{providerKeys.find(k => k.provider === 'bedrock')?.masked_key}</span>
            </p>
          </div>
        )}

        {/* Auth Mode Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Authentication Method</label>
          <div className="flex gap-2">
            <button
              onClick={() => setBedrockCreds(prev => ({ ...prev, authMode: 'bedrock_api_key' }))}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                bedrockCreds.authMode === 'bedrock_api_key'
                  ? 'border-orange-300 bg-orange-50 text-orange-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Shield className="w-4 h-4" />
                Bedrock API Key
              </div>
              <p className="text-xs mt-1 opacity-75">Single base64 token</p>
            </button>
            <button
              onClick={() => setBedrockCreds(prev => ({ ...prev, authMode: 'iam' }))}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                bedrockCreds.authMode === 'iam'
                  ? 'border-orange-300 bg-orange-50 text-orange-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Key className="w-4 h-4" />
                IAM Credentials
              </div>
              <p className="text-xs mt-1 opacity-75">Access Key ID + Secret</p>
            </button>
            <button
              onClick={() => setBedrockCreds(prev => ({ ...prev, authMode: 'api_key' }))}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                bedrockCreds.authMode === 'api_key'
                  ? 'border-orange-300 bg-orange-50 text-orange-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Key className="w-4 h-4" />
                Combined Key
              </div>
              <p className="text-xs mt-1 opacity-75">access_key:secret_key</p>
            </button>
          </div>
        </div>

        {/* IAM Credentials Mode */}
        {bedrockCreds.authMode === 'iam' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">AWS Access Key ID</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={bedrockCreds.accessKeyId}
                  onChange={e => setBedrockCreds(prev => ({ ...prev, accessKeyId: e.target.value }))}
                  placeholder="AKIA..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">AWS Secret Access Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={bedrockCreds.secretAccessKey}
                  onChange={e => setBedrockCreds(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                  placeholder="Enter secret access key..."
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">AWS Region</label>
              <select
                value={bedrockCreds.region}
                onChange={e => setBedrockCreds(prev => ({ ...prev, region: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="us-east-1">US East (N. Virginia) - us-east-1</option>
                <option value="us-west-2">US West (Oregon) - us-west-2</option>
                <option value="eu-west-1">EU (Ireland) - eu-west-1</option>
                <option value="eu-central-1">EU (Frankfurt) - eu-central-1</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore) - ap-southeast-1</option>
                <option value="ap-northeast-1">Asia Pacific (Tokyo) - ap-northeast-1</option>
                <option value="ap-south-1">Asia Pacific (Mumbai) - ap-south-1</option>
                <option value="ca-central-1">Canada (Central) - ca-central-1</option>
                <option value="sa-east-1">South America (São Paulo) - sa-east-1</option>
              </select>
            </div>
          </div>
        )}

        {/* Bedrock API Key Mode */}
        {bedrockCreds.authMode === 'bedrock_api_key' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bedrock API Key</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={bedrockCreds.bedrockApiKey}
                  onChange={e => setBedrockCreds(prev => ({ ...prev, bedrockApiKey: e.target.value }))}
                  placeholder="ABSK..."
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Base64-encoded Bedrock API Key (starts with ABSK after decoding)</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">AWS Region</label>
              <select
                value={bedrockCreds.region}
                onChange={e => setBedrockCreds(prev => ({ ...prev, region: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="us-east-1">US East (N. Virginia) - us-east-1</option>
                <option value="us-west-2">US West (Oregon) - us-west-2</option>
                <option value="eu-west-1">EU (Ireland) - eu-west-1</option>
                <option value="eu-central-1">EU (Frankfurt) - eu-central-1</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore) - ap-southeast-1</option>
                <option value="ap-northeast-1">Asia Pacific (Tokyo) - ap-northeast-1</option>
                <option value="ap-south-1">Asia Pacific (Mumbai) - ap-south-1</option>
                <option value="ca-central-1">Canada (Central) - ca-central-1</option>
                <option value="sa-east-1">South America (São Paulo) - sa-east-1</option>
              </select>
            </div>
          </div>
        )}

        {/* Combined API Key Mode */}
        {bedrockCreds.authMode === 'api_key' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API Key (access_key:secret_key)</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={bedrockCreds.apiKey}
                  onChange={e => setBedrockCreds(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="AKIA...:wJalrXUtnFEMI..."
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Format: ACCESS_KEY_ID:SECRET_ACCESS_KEY</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">AWS Region</label>
              <select
                value={bedrockCreds.region}
                onChange={e => setBedrockCreds(prev => ({ ...prev, region: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="us-east-1">US East (N. Virginia) - us-east-1</option>
                <option value="us-west-2">US West (Oregon) - us-west-2</option>
                <option value="eu-west-1">EU (Ireland) - eu-west-1</option>
                <option value="eu-central-1">EU (Frankfurt) - eu-central-1</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore) - ap-southeast-1</option>
                <option value="ap-northeast-1">Asia Pacific (Tokyo) - ap-northeast-1</option>
                <option value="ap-south-1">Asia Pacific (Mumbai) - ap-south-1</option>
                <option value="ca-central-1">Canada (Central) - ca-central-1</option>
                <option value="sa-east-1">South America (São Paulo) - sa-east-1</option>
              </select>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-4">
          <button
            onClick={handleSaveBedrockKey}
            disabled={savingBedrock || (
              bedrockCreds.authMode === 'iam'
                ? !bedrockCreds.accessKeyId || !bedrockCreds.secretAccessKey
                : bedrockCreds.authMode === 'bedrock_api_key'
                  ? !bedrockCreds.bedrockApiKey
                  : !bedrockCreds.apiKey
            )}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{
              backgroundColor: savingBedrock ? '#9ca3af' : customization.primaryColor,
            }}
          >
            {savingBedrock ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              'Save Bedrock Credentials'
            )}
          </button>
        </div>

        {/* Bedrock Cloud Models Discovery */}
        {providerKeys.find(k => k.provider === 'bedrock')?.configured && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {registerSuccess && (
              <div className="mb-3 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-800">{registerSuccess}</p>
              </div>
            )}
            {(() => {
              const bedrockCloudData = cloudModels['bedrock'];
              return !bedrockCloudData ? (
                <button
                  onClick={() => fetchCloudModels('bedrock')}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  Show available Bedrock models
                </button>
              ) : bedrockCloudData.models.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  {bedrockCloudData.needs_key_resave ? (
                    <>
                      <strong>Bedrock credentials need to be re-saved.</strong> The credentials are stored in LiteLLM but are not accessible for listing models (this can happen after a service restart). Please re-enter and save your Bedrock credentials above to restore access.
                    </>
                  ) : bedrockCloudData.provider_error ? (
                    <>
                      {bedrockCloudData.provider_error}
                    </>
                  ) : (
                    <>
                      No models available. If you just saved credentials, click &quot;Refresh&quot; below to retry.
                    </>
                  )}
                  <button
                    onClick={() => fetchCloudModels('bedrock')}
                    className="ml-2 text-blue-600 hover:text-blue-800 font-medium underline"
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">
                      Available Models ({bedrockCloudData.models.length})
                    </h4>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => fetchCloudModels('bedrock')}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                      </button>
                      {bedrockCloudData.models.some(m => !m.registered) && (
                        <button
                          onClick={() => handleRegisterAllUnregistered('bedrock')}
                          disabled={registeringModels}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          {registeringModels ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          Register all
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {bedrockCloudData.models.map(m => (
                      <div key={m.id} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded">
                        <div className="min-w-0 flex-1 mr-2">
                          <span className="text-xs font-medium text-gray-900">{m.name}</span>
                          {m.name !== m.id && (
                            <span className="text-xs text-gray-400 ml-2">{m.id}</span>
                          )}
                        </div>
                        {m.registered ? (
                          <span className="text-xs text-green-600 flex items-center gap-1 shrink-0">
                            <Check className="w-3 h-3" /> Registered
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRegisterModels('bedrock', [m.id])}
                            disabled={registeringModels}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 shrink-0"
                          >
                            Register
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Section 5: Chat Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-green-50">
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Chat Settings</h2>
            <p className="text-sm text-gray-500">Configure how AI chat responses are delivered</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
          <div>
            <div className="text-sm font-medium text-gray-900">Streaming Responses</div>
            <div className="text-xs text-gray-500 mt-0.5">
              When enabled, responses appear word-by-word in real time. When disabled, the full response is returned at once.
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loadingStreamingConfig ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            ) : (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={streamingEnabled}
                  onChange={e => handleStreamingToggle(e.target.checked)}
                  disabled={savingStreamingConfig}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                <span className="ms-3 text-sm font-medium text-gray-700">
                  {streamingEnabled ? 'On' : 'Off'}
                </span>
              </label>
            )}
          </div>
        </div>
      </div>

      </>}

      {/* ── Playgrounds ── */}
      {activeSection === 'playgrounds' && <>

      {/* Media Playgrounds */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-rose-50">
            <Mic className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Media Playgrounds</h2>
            <p className="text-sm text-gray-500">Test speech-to-text, text-to-speech, and image generation</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-5 w-fit">
          {[
            { id: 'stt' as const, label: 'Transcribe (STT)', icon: Mic },
            { id: 'tts' as const, label: 'Voice (TTS)', icon: Volume2 },
            { id: 'image' as const, label: 'Image Gen', icon: ImageIcon },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setMediaTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mediaTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {mediaTab === 'stt' && (
          <MediaPlaygroundSTT
            primaryColor={customization.primaryColor}
            transcribeServerRunning={mediaStatus.transcribe?.running}
            onEnsureServer={() => handleEnsureMediaServer('transcribe')}
            onStatusChange={fetchMediaStatus}
          />
        )}
        {mediaTab === 'tts' && (
          <MediaPlaygroundTTS
            primaryColor={customization.primaryColor}
          />
        )}
        {mediaTab === 'image' && (
          <MediaPlaygroundImage
            primaryColor={customization.primaryColor}
            imageServerRunning={mediaStatus.image?.running}
            onEnsureServer={() => handleEnsureMediaServer('image')}
            onStatusChange={fetchMediaStatus}
          />
        )}
      </div>

      {/* Section 5: Playground */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-amber-50">
            <Zap className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">LLM Playground</h2>
            <p className="text-sm text-gray-500">Test models directly - both local and cloud</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Model + Settings Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <select
                value={playgroundModel}
                onChange={e => setPlaygroundModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {models.length > 0 && models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.id}{m.provider ? ` (${m.provider})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temperature: {temperature.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-full mt-2"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Tokens <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={e => setMaxTokens(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="Auto"
                min="1"
                max="128000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <button
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {showSystemPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              System Prompt
              {playgroundSystemPrompt && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">set</span>
              )}
            </button>
            {showSystemPrompt && (
              <textarea
                value={playgroundSystemPrompt}
                onChange={e => setPlaygroundSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant..."
                rows={2}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-y"
              />
            )}
          </div>

          {/* User Prompt + Send */}
          <div className="flex gap-2">
            <textarea
              value={playgroundMessages}
              onChange={e => setPlaygroundMessages(e.target.value)}
              placeholder="Type your prompt here..."
              rows={3}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-y"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handlePlaygroundSend();
                }
              }}
            />
            <button
              onClick={handlePlaygroundSend}
              disabled={playgroundLoading || !playgroundMessages.trim()}
              className="self-end px-4 py-2 text-white rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
              style={{
                backgroundColor: playgroundLoading || !playgroundMessages.trim() ? '#9ca3af' : customization.primaryColor,
              }}
              title="Send (Cmd+Enter)"
            >
              {playgroundLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </div>
          <p className="text-xs text-gray-400">Press Cmd+Enter to send</p>

          {/* Result Area */}
          {playgroundError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-800">Error</span>
                {playgroundTime !== null && (
                  <span className="text-xs text-red-400 ml-auto">{(playgroundTime / 1000).toFixed(1)}s</span>
                )}
              </div>
              <p className="text-sm text-red-700 whitespace-pre-wrap">{playgroundError}</p>
            </div>
          )}

          {playgroundResult && (
            <div ref={resultRef} className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 border-b border-gray-200">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700">
                  Response from <span className="font-mono">{playgroundResult.model}</span>
                </span>
                <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
                  {playgroundTime !== null && <span>{(playgroundTime / 1000).toFixed(1)}s</span>}
                  {playgroundResult.usage && (
                    <>
                      <span>{playgroundResult.usage.prompt_tokens || 0} in</span>
                      <span>{playgroundResult.usage.completion_tokens || 0} out</span>
                      <span className="font-medium">{playgroundResult.usage.total_tokens || 0} total</span>
                    </>
                  )}
                  <button
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                    title={showRawJson ? 'Hide raw JSON' : 'Show raw JSON'}
                  >
                    {showRawJson ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    JSON
                  </button>
                </div>
              </div>
              <div className="p-4">
                {showRawJson ? (
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                    {JSON.stringify(playgroundResult.raw || playgroundResult, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {playgroundResult.content}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      </>}
    </div>
  );
}
