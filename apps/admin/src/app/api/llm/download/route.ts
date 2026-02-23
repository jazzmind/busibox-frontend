/**
 * POST /api/llm/download
 * 
 * Trigger model download for local LLM.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getSessionUser, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';

const DEPLOY_API_URL = process.env.DEPLOYMENT_SERVICE_URL || 'http://deploy-api:8011/api/v1/deployment';

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    // Check if local LLM is configured
    const llmBackend = process.env.LLM_BACKEND;
    if (!llmBackend || llmBackend === 'cloud') {
      return apiError('Local LLM not configured. Cannot download models for cloud backend.', 400);
    }

    // Call deploy-api to trigger model download
    // This would run the download-models.sh script on the host
    try {
      const response = await fetch(`${DEPLOY_API_URL}/llm/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backend: llmBackend,
          tier: process.env.LLM_TIER || 'minimal',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return apiError(error.message || 'Failed to start model download', response.status);
      }

      return apiSuccess({
        message: 'Model download started',
        backend: llmBackend,
        tier: process.env.LLM_TIER,
      });
    } catch (fetchError) {
      console.error('[API] Deploy API call failed:', fetchError);
      return apiError('Failed to connect to deployment service', 503);
    }
  } catch (error) {
    console.error('[API] Download models error:', error);
    return apiError('Failed to start model download', 500);
  }
}
