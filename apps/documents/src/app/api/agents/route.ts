/**
 * Agents API Route
 *
 * GET: List agents from the agent API (for trigger configuration, etc.)
 * Proxies to AGENT_API_URL/agents with token exchange.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const agentApiUrl =
      process.env.AGENT_API_URL ||
      process.env.NEXT_PUBLIC_AGENT_API_URL ||
      'http://localhost:8000';

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'agent-api',
      purpose: 'list-agents',
    });

    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '100';
    const response = await fetch(`${agentApiUrl}/agents?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Agent API list failed:', response.status, errorText);
      return apiError('Failed to list agents', response.status);
    }

    const data = await response.json();
    const agents = Array.isArray(data) ? data : data.agents || data.data || [];
    return apiSuccess({ agents });
  } catch (error: unknown) {
    console.error('[API] List agents error:', error);
    return apiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}
