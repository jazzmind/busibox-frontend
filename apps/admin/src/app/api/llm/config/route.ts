/**
 * GET/PUT /api/llm/config
 * 
 * Get and update LLM configuration.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getSessionUser, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    // Get LLM config from environment
    const config = {
      backend: process.env.LLM_BACKEND === 'mlx' || process.env.LLM_BACKEND === 'vllm' ? 'local' : 'cloud',
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ? '****' + process.env.AWS_ACCESS_KEY_ID.slice(-4) : '',
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? '********' : '',
      awsRegion: process.env.AWS_REGION_NAME || 'us-east-1',
    };

    return apiSuccess({ config });
  } catch (error) {
    console.error('[API] Get LLM config error:', error);
    return apiError('Failed to get LLM configuration', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    const body = await request.json();
    const { config } = body;

    if (!config) {
      return apiError('Invalid config', 400);
    }

    // Validate backend selection
    if (!['local', 'cloud'].includes(config.backend)) {
      return apiError('Invalid backend. Must be "local" or "cloud"', 400);
    }

    // If cloud, validate AWS credentials
    if (config.backend === 'cloud') {
      if (!config.awsAccessKeyId || config.awsAccessKeyId.includes('****')) {
        // Skip validation if masked (unchanged)
      } else if (!config.awsSecretAccessKey || config.awsSecretAccessKey.includes('****')) {
        // Skip validation if masked (unchanged)
      } else {
        // TODO: Validate AWS credentials with a test call
      }
    }

    // In a real implementation, this would:
    // 1. Store config in database/vault
    // 2. Call deploy-api to update LiteLLM configuration
    // 3. Regenerate litellm.yaml
    // 4. Restart LiteLLM service

    console.log('[API] LLM config update:', { backend: config.backend });

    return apiSuccess({ 
      message: 'LLM configuration updated',
      backend: config.backend,
    });
  } catch (error) {
    console.error('[API] Update LLM config error:', error);
    return apiError('Failed to update LLM configuration', 500);
  }
}
