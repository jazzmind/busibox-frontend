/**
 * Admin LLM Cloud Models API Route
 * 
 * GET /api/llm-cloud-models?provider=openai - List available cloud models
 * POST /api/llm-cloud-models - Register cloud models in LiteLLM
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

async function getAgentApiToken(sessionJwt: string) {
  const userId = getUserIdFromSessionJwt(sessionJwt);
  if (!userId) throw new Error('Failed to get userId from session');
  return exchangeWithSubjectToken({
    sessionJwt, userId, audience: 'agent-api', purpose: 'admin-llm-cloud-models',
  });
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const agentApiUrl = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';
    const provider = request.nextUrl.searchParams.get('provider') || 'openai';

    try {
      const tokenResult = await getAgentApiToken(sessionJwt);
      const response = await fetch(`${agentApiUrl}/llm/cloud-models/${provider}`, {
        headers: { 'Authorization': `Bearer ${tokenResult.accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        return apiSuccess(data);
      } else {
        const errorText = await response.text();
        console.error('Agent API cloud-models GET error:', response.status, errorText);
        return apiError(`Agent API error: ${response.status}`, response.status);
      }
    } catch (error) {
      console.error('Failed to fetch cloud models:', error);
      return apiError('Failed to fetch cloud models', 502);
    }
  } catch (error) {
    console.error('Cloud models GET API error:', error);
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

    try {
      const tokenResult = await getAgentApiToken(sessionJwt);
      const response = await fetch(`${agentApiUrl}/llm/cloud-models/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return apiSuccess(data);
      } else {
        const errorText = await response.text();
        console.error('Agent API cloud-models register error:', response.status, errorText);
        return apiError(`Failed to register models: ${errorText}`, response.status);
      }
    } catch (error) {
      console.error('Failed to register cloud models:', error);
      return apiError('Failed to register cloud models', 502);
    }
  } catch (error) {
    console.error('Cloud models POST API error:', error);
    return apiError('Internal server error', 500);
  }
}
