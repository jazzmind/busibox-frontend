/**
 * Model Registry Service
 * 
 * Provides model selection utilities with all metadata sourced from liteLLM.
 * No hardcoded model names, descriptions, or capabilities -- everything
 * comes from liteLLM's /model/info endpoint, which is populated from
 * model_registry.yml at config generation time.
 */

import { fetchAvailableModels, fetchAllModelInfo, formatModelName, type ModelOption, type ModelInfo } from './litellm';

export type { ModelOption };

// Cache for models (refreshed every 60 seconds)
let cachedModels: ModelOption[] | null = null;
let cachedModelInfo: ModelInfo[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000;

async function ensureCache(): Promise<void> {
  const now = Date.now();
  if (cachedModels && cachedModelInfo && (now - cacheTimestamp) < CACHE_TTL) {
    return;
  }

  const [models, allInfo] = await Promise.all([
    fetchAvailableModels(),
    fetchAllModelInfo(),
  ]);

  cachedModels = models;
  cachedModelInfo = allInfo;
  cacheTimestamp = Date.now();
}

/**
 * Get available model options for chat UI.
 * All metadata comes from liteLLM's model_info.
 */
export async function getAvailableModels(): Promise<ModelOption[]> {
  await ensureCache();
  return cachedModels || [];
}

/**
 * Get model name from model ID. Returns the ID as-is since
 * liteLLM expects the purpose name directly.
 */
export async function getModelName(modelId?: string): Promise<string> {
  return modelId || 'chat';
}

/**
 * Get model display name from liteLLM model_info.
 */
export async function getModelDisplayName(modelId?: string): Promise<string> {
  if (!modelId) return 'Chat';

  await ensureCache();
  const info = cachedModelInfo?.find(m => m.id === modelId);
  if (info?.display_name) return info.display_name;

  const model = cachedModels?.find(m => m.id === modelId);
  return model?.name || formatModelName(modelId);
}

/**
 * Get native model capabilities from liteLLM model_info.
 * These reflect what the underlying model actually supports.
 */
export async function getModelCapabilities(modelId?: string): Promise<{
  multimodal: boolean;
  toolCalling: boolean;
} | undefined> {
  if (!modelId) return undefined;

  await ensureCache();
  const info = cachedModelInfo?.find(m => m.id === modelId);
  if (!info) return undefined;

  return {
    multimodal: info.multimodal ?? false,
    toolCalling: info.tool_calling ?? false,
  };
}

/**
 * Get native model capabilities (synchronous lookup from cache).
 * Returns undefined if cache is not populated yet.
 * Prefer the async getModelCapabilities() when possible.
 */
export function getNativeModelCapabilities(modelId?: string): {
  multimodal: boolean;
  toolCalling: boolean;
} | undefined {
  if (!modelId || !cachedModelInfo) return undefined;

  const info = cachedModelInfo.find(m => m.id === modelId);
  if (!info) return undefined;

  return {
    multimodal: info.multimodal ?? false,
    toolCalling: info.tool_calling ?? false,
  };
}

/**
 * Clear the model cache (useful for testing or manual refresh)
 */
export function clearModelCache(): void {
  cachedModels = null;
  cachedModelInfo = null;
  cacheTimestamp = 0;
}
