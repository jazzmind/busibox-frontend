/**
 * Admin LLM Completions API Route
 * 
 * Proxies chat completion requests to agent-api's LLM endpoint.
 * Supports both regular and streaming responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const agentApiUrl = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';

    const body = await request.json();
    const isStreaming = body.stream === true;

    try {
      const userId = getUserIdFromSessionJwt(sessionJwt);
      if (!userId) {
        return apiError('Failed to get userId from session', 401);
      }

      const tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId,
        audience: 'agent-api',
        purpose: 'admin-llm-completions',
      });

      const response = await fetch(`${agentApiUrl}/llm/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Agent API llm/completions error:', response.status, errorText);
        return apiError(`LLM completion failed: ${errorText}`, response.status);
      }

      // If streaming, proxy the SSE stream
      if (isStreaming && response.body) {
        return new NextResponse(response.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        });
      }

      // Non-streaming: return JSON directly
      const data = await response.json();
      return NextResponse.json({ success: true, data });
    } catch (error) {
      console.error('Failed to complete LLM request:', error);
      return apiError('Failed to complete LLM request', 502);
    }
  } catch (error) {
    console.error('LLM completions API error:', error);
    return apiError('Internal server error', 500);
  }
}
