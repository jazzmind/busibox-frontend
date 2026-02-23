/**
 * LiteLLM Client
 * 
 * Fetches model information from liteLLM proxy. All model metadata
 * (display names, descriptions, capabilities) comes from liteLLM's
 * model_info, which is populated from model_registry.yml at config
 * generation time. No hardcoded model names or descriptions.
 */

const LITELLM_BASE_URL = (process.env.LITELLM_BASE_URL || 'http://localhost:4000').replace(/\/v1\/?$/, '');
const LITELLM_API_KEY = process.env.LITELLM_API_KEY;

export interface ModelInfo {
  id: string;
  display_name?: string;
  description?: string;
  multimodal?: boolean;
  tool_calling?: boolean;
  mode?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  capabilities?: {
    multimodal: boolean;
    toolCalling: boolean;
  };
}

function isNextPrerenderBailout(error: unknown): boolean {
  const anyErr = error as { digest?: unknown; message?: unknown };
  const digest = typeof anyErr?.digest === 'string' ? anyErr.digest : '';
  if (digest === 'NEXT_PRERENDER_INTERRUPTED' || digest === 'HANGING_PROMISE_REJECTION') return true;

  const msg = typeof anyErr?.message === 'string' ? anyErr.message : '';
  return (
    msg.includes('needs to bail out of prerendering') ||
    msg.includes('cookies() rejects when the prerender is complete') ||
    msg.includes('fetch() rejects when the prerender is complete')
  );
}

function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return LITELLM_BASE_URL;
  }
  return LITELLM_BASE_URL.startsWith('http')
    ? LITELLM_BASE_URL
    : window.location.origin.replace(/:\d+$/, '') + ':4000';
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (LITELLM_API_KEY) {
    headers['Authorization'] = `Bearer ${LITELLM_API_KEY}`;
  }
  return headers;
}

/**
 * Format a model/purpose ID into a human-readable display name.
 * Used as fallback when display_name is not in model_info.
 */
export function formatModelName(modelId: string): string {
  return modelId
    .split(/[-_]/)
    .map(part => {
      if (part === part.toUpperCase() && part.length > 1) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

/**
 * Check if a model is a chat/text model (not embedding, transcription, etc.)
 */
function isChatModel(info: ModelInfo): boolean {
  const nonChatModes = ['audio_transcription', 'audio_speech', 'image_generation', 'embedding'];
  if (info.mode && nonChatModes.includes(info.mode)) return false;
  const nonChatKeywords = ['embedding', 'embed', 'colpali', 'rerank', 'whisper', 'kokoro', 'flux', 'sora'];
  return !nonChatKeywords.some(kw => info.id.toLowerCase().includes(kw));
}

/**
 * Fetch all models with full metadata from liteLLM's /model/info endpoint.
 * Returns all models (unfiltered) with capabilities from model_info.
 */
export async function fetchAllModelInfo(): Promise<ModelInfo[]> {
  try {
    const response = await fetch(`${getBaseUrl()}/v1/model/info`, {
      headers: getHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[LiteLLM] Failed to fetch model info: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const models: any[] = data.data || [];

    return models.map((entry: any) => {
      const info = entry.model_info || {};
      return {
        id: entry.model_name,
        display_name: info.display_name,
        description: info.description,
        multimodal: info.multimodal,
        tool_calling: info.tool_calling,
        mode: info.mode,
      };
    });
  } catch (error) {
    if (!isNextPrerenderBailout(error)) {
      console.error('[LiteLLM] Error fetching model info:', error);
    }
    return [];
  }
}

/**
 * Fetch available chat models from liteLLM, with display names and capabilities
 * sourced from model_info (populated from model_registry.yml).
 */
export async function fetchAvailableModels(): Promise<ModelOption[]> {
  const allModels = await fetchAllModelInfo();

  if (allModels.length === 0) {
    return getFallbackModels();
  }

  const seen = new Set<string>();
  return allModels
    .filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return isChatModel(m);
    })
    .map(m => ({
      id: m.id,
      name: m.display_name || formatModelName(m.id),
      description: m.description,
      capabilities: {
        multimodal: m.multimodal ?? false,
        toolCalling: m.tool_calling ?? false,
      },
    }));
}

/**
 * Minimal fallback when liteLLM is unreachable.
 * Uses generic purpose names without hardcoded model-specific details.
 */
function getFallbackModels(): ModelOption[] {
  return [
    { id: 'chat', name: 'Chat', description: 'General chat model' },
    { id: 'fast', name: 'Fast', description: 'Fast model for quick operations' },
    { id: 'frontier', name: 'Frontier', description: 'Most capable model' },
  ];
}

/**
 * Check if liteLLM is healthy
 */
export async function checkLiteLLMHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getBaseUrl()}/health`, {
      next: { revalidate: 30 },
    } as RequestInit);
    return response.ok;
  } catch {
    return false;
  }
}
