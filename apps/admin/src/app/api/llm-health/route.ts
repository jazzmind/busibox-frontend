/**
 * Admin LLM Health API Route
 * 
 * Checks health of LLM backends (LiteLLM, MLX) via agent-api.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const agentApiUrl = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';

    try {
      const userId = getUserIdFromSessionJwt(sessionJwt);
      if (!userId) {
        return apiSuccess({
          litellm: false,
          litellm_url: agentApiUrl,
          models_available: 0,
          error: 'Failed to get userId from session JWT',
        });
      }

      const tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId,
        audience: 'agent-api',
        purpose: 'admin-llm-health',
      });

      const response = await fetch(`${agentApiUrl}/llm/health`, {
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        return apiSuccess(data);
      } else {
        const errorText = await response.text().catch(() => 'unknown');
        console.error('Agent API llm/health error:', response.status, errorText);
        return apiSuccess({
          litellm: false,
          litellm_url: agentApiUrl,
          models_available: 0,
          error: `agent-api returned ${response.status}: ${errorText.slice(0, 200)}`,
        });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Failed to check LLM health:', msg);
      return apiSuccess({
        litellm: false,
        litellm_url: agentApiUrl,
        models_available: 0,
        error: `Connection failed: ${msg}`,
      });
    }
  } catch (error) {
    console.error('LLM health API error:', error);
    return apiError('Internal server error', 500);
  }
}
