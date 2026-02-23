/**
 * GET /api/llm/system
 * 
 * Get system info for LLM configuration.
 * Detects hardware capabilities and returns model tier.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getSessionUser, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';

// Model registry - should match config/demo-models.yaml
const MODEL_REGISTRY: Record<string, { mlx: { fast: string; agent: string; frontier: string }; vllm: { fast: string; agent: string; frontier: string } }> = {
  minimal: {
    mlx: {
      fast: 'mlx-community/Qwen2.5-1.5B-Instruct-4bit',
      agent: 'mlx-community/Qwen2.5-3B-Instruct-4bit',
      frontier: 'mlx-community/Qwen2.5-7B-Instruct-4bit',
    },
    vllm: {
      fast: 'Qwen/Qwen2.5-1.5B-Instruct-AWQ',
      agent: 'Qwen/Qwen2.5-3B-Instruct-AWQ',
      frontier: 'Qwen/Qwen2.5-7B-Instruct-AWQ',
    },
  },
  standard: {
    mlx: {
      fast: 'mlx-community/Qwen2.5-3B-Instruct-4bit',
      agent: 'mlx-community/Qwen2.5-7B-Instruct-4bit',
      frontier: 'mlx-community/Qwen2.5-14B-Instruct-4bit',
    },
    vllm: {
      fast: 'Qwen/Qwen2.5-3B-Instruct-AWQ',
      agent: 'Qwen/Qwen2.5-7B-Instruct-AWQ',
      frontier: 'Qwen/Qwen2.5-14B-Instruct-AWQ',
    },
  },
  enhanced: {
    mlx: {
      fast: 'mlx-community/Qwen2.5-7B-Instruct-4bit',
      agent: 'mlx-community/Qwen2.5-14B-Instruct-4bit',
      frontier: 'mlx-community/Qwen2.5-32B-Instruct-4bit',
    },
    vllm: {
      fast: 'Qwen/Qwen2.5-7B-Instruct-AWQ',
      agent: 'Qwen/Qwen2.5-14B-Instruct-AWQ',
      frontier: 'Qwen/Qwen2.5-32B-Instruct-AWQ',
    },
  },
  professional: {
    mlx: {
      fast: 'mlx-community/Qwen2.5-14B-Instruct-4bit',
      agent: 'mlx-community/Qwen2.5-32B-Instruct-4bit',
      frontier: 'mlx-community/Qwen2.5-72B-Instruct-4bit',
    },
    vllm: {
      fast: 'Qwen/Qwen2.5-14B-Instruct-AWQ',
      agent: 'Qwen/Qwen2.5-32B-Instruct-AWQ',
      frontier: 'Qwen/Qwen2.5-72B-Instruct-AWQ',
    },
  },
  enterprise: {
    mlx: {
      fast: 'mlx-community/Qwen2.5-32B-Instruct-4bit',
      agent: 'mlx-community/Qwen2.5-72B-Instruct-4bit',
      frontier: 'mlx-community/Qwen3-235B-A22B-Instruct-4bit',
    },
    vllm: {
      fast: 'Qwen/Qwen2.5-32B-Instruct-AWQ',
      agent: 'Qwen/Qwen2.5-72B-Instruct-AWQ',
      frontier: 'Qwen/Qwen3-235B-A22B-Instruct-AWQ',
    },
  },
  ultra: {
    mlx: {
      fast: 'mlx-community/Qwen2.5-72B-Instruct-4bit',
      agent: 'mlx-community/Qwen3-235B-A22B-Instruct-4bit',
      frontier: 'mlx-community/Llama-3.3-70B-Instruct-4bit',
    },
    vllm: {
      fast: 'Qwen/Qwen2.5-72B-Instruct-AWQ',
      agent: 'Qwen/Qwen3-235B-A22B-Instruct-AWQ',
      frontier: 'meta-llama/Llama-3.3-70B-Instruct-AWQ',
    },
  },
};

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    // Get system info from environment or detect
    // In Docker, this would be passed from the host via deploy-api
    const llmBackend = process.env.LLM_BACKEND || 'cloud';
    const llmTier = process.env.LLM_TIER || 'minimal';
    const ramGb = parseInt(process.env.DETECTED_RAM_GB || '16', 10);
    const arch = process.env.DETECTED_ARCH || process.arch;

    // Get models for this tier
    const backend = llmBackend as 'mlx' | 'vllm' | 'cloud';
    const tierModels = MODEL_REGISTRY[llmTier];
    const models = backend !== 'cloud' && tierModels 
      ? tierModels[backend] 
      : { fast: 'N/A', agent: 'N/A', frontier: 'N/A' };

    return apiSuccess({
      backend,
      tier: llmTier,
      ramGb,
      arch,
      models,
    });
  } catch (error) {
    console.error('[API] Get LLM system info error:', error);
    return apiError('Failed to get system info', 500);
  }
}
