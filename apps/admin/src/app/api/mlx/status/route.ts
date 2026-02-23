/**
 * MLX Status API Route
 * 
 * GET /api/mlx/status - Get MLX server status
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getCurrentUserWithSessionFromCookies, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

/**
 * GET /api/mlx/status
 * Get MLX server status (running, model, health)
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

    // Exchange token
    let adminToken = sessionJwt;
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'services:read'],
          purpose: 'MLX status check',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: true,
        }
      );
      adminToken = exchangeResult.accessToken;
    } catch (error) {
      console.warn('[API/mlx/status] Token exchange error:', error);
    }

    // Get MLX health via deploy-api (which checks host-agent)
    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/health`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: 'vllm',
        endpoint: '/health',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[API/mlx/status] Deploy-api error: ${response.status} - ${errorText}`);
      return apiError(`Failed to get MLX status: ${errorText}`, response.status);
    }

    const statusData = await response.json();
    
    // Check if this is actually MLX (not vLLM)
    if (statusData.backend === 'mlx') {
      return apiSuccess({
        available: true,
        running: statusData.running || statusData.healthy,
        healthy: statusData.healthy,
        model: statusData.model,
        backend: 'mlx',
      });
    } else if (statusData.backend === 'vllm') {
      return apiSuccess({
        available: false,
        backend: 'vllm',
        message: 'System is using vLLM (NVIDIA GPU), not MLX',
      });
    } else {
      return apiSuccess({
        available: false,
        backend: statusData.backend || 'cloud',
        message: 'No local LLM runtime available',
      });
    }
  } catch (error) {
    console.error('[API] Get MLX status error:', error);
    return apiError('Failed to get MLX status', 500);
  }
}
