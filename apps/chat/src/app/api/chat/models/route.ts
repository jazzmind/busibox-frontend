/**
 * API Route: Get Available Models
 *
 * Proxies to agent API to get available models with capabilities.
 * This ensures consistent model information across the application.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthorizationHeaderWithSession } from '@jazzmind/busibox-app/lib/authz/next-client';

const AGENT_API_URL =
  process.env.AGENT_API_URL ||
  (process.env.AGENT_HOST
    ? `http://${process.env.AGENT_HOST}:${process.env.AGENT_API_PORT || 8000}`
    : 'https://localhost/api/agent');

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user } = authResult;

    // Get session JWT for Zero Trust exchange
    const sessionJwt = getSessionJwt(request);
    if (!sessionJwt) {
      return apiError('Missing session JWT', 401);
    }

    // Get agent API token using Zero Trust (no client credentials)
    const authHeader = await getAuthorizationHeaderWithSession({
      sessionJwt,
      userId: user.id,
      audience: 'agent-api',
      scopes: [],
      purpose: 'get-models',
    });

    // Forward request to agent API
    const response = await fetch(`${AGENT_API_URL}/chat/models`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MODELS API] Agent API error:', response.status, errorText);
      return apiError(`Failed to fetch models: ${errorText}`, response.status);
    }

    const data = await response.json();
    return Response.json(data, { status: 200 });
  } catch (error: any) {
    console.error('[MODELS API] Error:', error);
    return apiError(error.message || 'Failed to fetch models', 500);
  }
}

