/**
 * Admin LLM Models API Route
 * 
 * GET  - Lists available models from LiteLLM via agent-api.
 * POST - Delete models from LiteLLM (uses POST to agent-api /llm/models/delete).
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

async function getAgentApiToken(sessionJwt: string) {
  const userId = getUserIdFromSessionJwt(sessionJwt);
  if (!userId) throw new Error('Failed to get userId from session');
  return exchangeWithSubjectToken({
    sessionJwt, userId, audience: 'agent-api', purpose: 'admin-llm-models',
  });
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const agentApiUrl = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';

    try {
      const tokenResult = await getAgentApiToken(sessionJwt);
      const response = await fetch(`${agentApiUrl}/llm/models`, {
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return apiSuccess(data);
      } else {
        const errorText = await response.text();
        console.error('Agent API llm/models error:', response.status, errorText);
        return apiError(`Agent API error: ${response.status}`, response.status);
      }
    } catch (error) {
      console.error('Failed to fetch LLM models:', error);
      return apiError('Failed to fetch LLM models', 502);
    }
  } catch (error) {
    console.error('LLM models API error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const agentApiUrl = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';
    const body = await request.json();

    // Expects { action: 'delete', model_ids: string[] }
    if (body.action !== 'delete' || !Array.isArray(body.model_ids)) {
      return apiError('Invalid request. Expected { action: "delete", model_ids: string[] }', 400);
    }

    try {
      const tokenResult = await getAgentApiToken(sessionJwt);
      const response = await fetch(`${agentApiUrl}/llm/models/delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model_ids: body.model_ids }),
      });

      if (response.ok) {
        const data = await response.json();
        return apiSuccess(data);
      } else {
        const errorText = await response.text();
        console.error('Agent API model delete error:', response.status, errorText);
        return apiError(`Failed to delete models: ${errorText}`, response.status);
      }
    } catch (error) {
      console.error('Failed to delete models:', error);
      return apiError('Failed to delete models', 502);
    }
  } catch (error) {
    console.error('LLM models POST API error:', error);
    return apiError('Internal server error', 500);
  }
}
