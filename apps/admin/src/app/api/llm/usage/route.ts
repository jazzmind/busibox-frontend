/**
 * Admin LLM Usage API Route
 * 
 * Returns LLM usage statistics for the dashboard.
 * Proxies to agent-api which aggregates usage from workflow executions.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;

    // Get agent-api URL
    const agentApiUrl = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';
    
    try {
      // Exchange session JWT for agent-api token
      const userId = getUserIdFromSessionJwt(sessionJwt);
      if (!userId) {
        console.error('Failed to get userId from session JWT');
        return apiSuccess({
          models: [],
          tokensToday: 0,
        });
      }
      const tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId,
        audience: 'agent-api',
        purpose: 'admin-llm-usage',
      });

      // Call agent-api admin stats endpoint
      const response = await fetch(`${agentApiUrl}/admin/stats/usage?days=30`, {
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Transform the response to match expected format
        // Agent-api now returns detailed per-model stats from LiteLLM SpendLogs
        interface ModelStats {
          model: string;
          requests: number;
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          spend?: number;
          avg_latency_ms?: number;
        }
        
        const models = (data.models || []).map((m: ModelStats) => ({
          model: m.model,
          requests: m.requests,
          tokens: m.total_tokens || 0,
          inputTokens: m.input_tokens || 0,
          outputTokens: m.output_tokens || 0,
          spend: m.spend || 0,
          avgLatency: m.avg_latency_ms || 0,
        }));

        return apiSuccess({
          models: models.slice(0, 10), // Top 10 models
          tokensToday: data.tokensToday || 0,
          totalRequests: data.totalRequests || 0,
          totalInputTokens: data.totalInputTokens || 0,
          totalOutputTokens: data.totalOutputTokens || 0,
          totalTokens: (data.totalInputTokens || 0) + (data.totalOutputTokens || 0),
          totalSpend: data.totalSpend || 0,
        });
      } else {
        console.error('Agent API returned non-OK status:', response.status);
      }
    } catch (error) {
      // Log but don't fail - service may be unavailable
      console.error('Failed to fetch from agent-api:', error);
    }

    // Return empty stats if agent-api is not available
    return apiSuccess({
      models: [],
      tokensToday: 0,
    });
  } catch (error) {
    console.error('LLM usage API error:', error);
    return apiError('Internal server error', 500);
  }
}
