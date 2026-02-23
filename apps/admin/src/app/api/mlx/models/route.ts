/**
 * MLX Models API Routes
 * 
 * GET /api/mlx/models - List available and cached models
 * POST /api/mlx/models - Download a new model
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getCurrentUserWithSessionFromCookies, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

// Host agent URL (deploy-api proxies to it)
const HOST_AGENT_URL = process.env.HOST_AGENT_URL || 'http://host.docker.internal:8089';

async function getAdminToken(sessionJwt: string): Promise<string> {
  try {
    const exchangeResult = await exchangeTokenZeroTrust(
      {
        sessionJwt,
        audience: 'deploy-api',
        scopes: ['admin', 'mlx:read', 'mlx:write'],
        purpose: 'MLX model management',
      },
      {
        authzBaseUrl: AUTHZ_BASE_URL,
        verbose: true,
      }
    );
    return exchangeResult.accessToken;
  } catch (error) {
    console.warn('[API/mlx/models] Token exchange error:', error);
    return sessionJwt;
  }
}

/**
 * GET /api/mlx/models
 * List available models by tier and cached models
 */
export async function GET(request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) {
      return apiError('Authentication required', 401);
    }

    const { sessionJwt, ...user } = userWithSession;

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    const adminToken = await getAdminToken(sessionJwt);

    // Call deploy-api which proxies to host-agent
    // For now, we'll call host-agent directly via deploy-api network
    // In production, deploy-api should proxy these requests
    
    // First, check platform to see if MLX is available
    const platformResponse = await fetch(`${DEPLOY_API_BASE}/api/v1/services/platform`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!platformResponse.ok) {
      return apiError('Failed to get platform info', platformResponse.status);
    }

    const platformInfo = await platformResponse.json();
    
    if (platformInfo.backend !== 'mlx') {
      return apiSuccess({
        available: false,
        backend: platformInfo.backend,
        message: 'MLX is only available on Apple Silicon',
      });
    }

    // Call host-agent for model list
    // Note: deploy-api will need to proxy this, or we add a proxy route
    // For now, return platform-based model recommendations
    return apiSuccess({
      available: true,
      backend: 'mlx',
      tier: platformInfo.tier,
      ram_gb: platformInfo.ram_gb,
      // Include model recommendations based on tier
      recommended: getRecommendedModels(platformInfo.tier),
    });
  } catch (error) {
    console.error('[API] List MLX models error:', error);
    return apiError('Failed to list models', 500);
  }
}

/**
 * POST /api/mlx/models
 * Download a new model
 */
export async function POST(request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) {
      return apiError('Authentication required', 401);
    }

    const { sessionJwt, ...user } = userWithSession;

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    const body = await request.json();
    const { model } = body;

    if (!model) {
      return apiError('Model name is required', 400);
    }

    const adminToken = await getAdminToken(sessionJwt);

    // For model downloads, we need to proxy through deploy-api
    // This will be a streaming response for download progress
    // For now, return a simple response indicating the download was initiated
    
    return apiSuccess({
      initiated: true,
      model,
      message: 'Model download initiated. Use the SSE endpoint for progress.',
    });
  } catch (error) {
    console.error('[API] Download MLX model error:', error);
    return apiError('Failed to initiate model download', 500);
  }
}

// Helper function to get recommended models based on tier
function getRecommendedModels(tier: string): Record<string, { name: string; size: string; description: string }> {
  const models: Record<string, Record<string, { name: string; size: string; description: string }>> = {
    test: {
      fast: { name: 'mlx-community/Qwen2.5-0.5B-Instruct-4bit', size: '~300MB', description: 'Tiny model for testing' },
      agent: { name: 'mlx-community/Qwen2.5-0.5B-Instruct-4bit', size: '~300MB', description: 'Tiny model for testing' },
      frontier: { name: 'mlx-community/Qwen2.5-0.5B-Instruct-4bit', size: '~300MB', description: 'Tiny model for testing' },
    },
    minimal: {
      fast: { name: 'mlx-community/Qwen2.5-1.5B-Instruct-4bit', size: '~1GB', description: 'Quick responses' },
      agent: { name: 'mlx-community/Qwen2.5-3B-Instruct-4bit', size: '~2GB', description: 'Reasoning tasks' },
      frontier: { name: 'mlx-community/Qwen2.5-7B-Instruct-4bit', size: '~4GB', description: 'Best quality' },
    },
    standard: {
      fast: { name: 'mlx-community/Qwen2.5-3B-Instruct-4bit', size: '~2GB', description: 'Quick responses' },
      agent: { name: 'mlx-community/Qwen2.5-7B-Instruct-4bit', size: '~4GB', description: 'Reasoning tasks' },
      frontier: { name: 'mlx-community/Qwen2.5-14B-Instruct-4bit', size: '~8GB', description: 'Best quality' },
    },
    enhanced: {
      fast: { name: 'mlx-community/Qwen2.5-7B-Instruct-4bit', size: '~4GB', description: 'Quick responses' },
      agent: { name: 'mlx-community/Qwen2.5-14B-Instruct-4bit', size: '~8GB', description: 'Reasoning tasks' },
      frontier: { name: 'mlx-community/Qwen2.5-32B-Instruct-4bit', size: '~18GB', description: 'Best quality' },
    },
    professional: {
      fast: { name: 'mlx-community/Qwen2.5-14B-Instruct-4bit', size: '~8GB', description: 'Quick responses' },
      agent: { name: 'mlx-community/Qwen2.5-32B-Instruct-4bit', size: '~18GB', description: 'Reasoning tasks' },
      frontier: { name: 'mlx-community/Qwen2.5-72B-Instruct-4bit', size: '~40GB', description: 'Best quality' },
    },
    enterprise: {
      fast: { name: 'mlx-community/Qwen2.5-32B-Instruct-4bit', size: '~18GB', description: 'Quick responses' },
      agent: { name: 'mlx-community/Qwen2.5-72B-Instruct-4bit', size: '~40GB', description: 'Reasoning tasks' },
      frontier: { name: 'mlx-community/Qwen3-235B-A22B-Instruct-4bit', size: '~65GB', description: 'Best quality' },
    },
    ultra: {
      fast: { name: 'mlx-community/Qwen2.5-72B-Instruct-4bit', size: '~40GB', description: 'Quick responses' },
      agent: { name: 'mlx-community/Qwen3-235B-A22B-Instruct-4bit', size: '~65GB', description: 'Reasoning tasks' },
      frontier: { name: 'mlx-community/Llama-3.3-70B-Instruct-4bit', size: '~40GB', description: 'Best quality' },
    },
  };

  return models[tier] || models.minimal;
}
