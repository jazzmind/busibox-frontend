import { NextRequest, NextResponse } from 'next/server';
import { getAgentApiUrl } from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

const AGENT_API_URL = getAgentApiUrl();

/**
 * GET /api/streams/task-executions/[id]
 * Server-Sent Events stream for task execution updates (with workflow step progress)
 * 
 * Proxies SSE from the agent-server, adding authentication.
 * Uses token exchange to get a valid agent-api token (Zero Trust).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: executionId } = await params;

  try {
    // Exchange SSO token for agent-api token (Zero Trust)
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    // Connect to agent-server SSE endpoint with exchanged token
    const sseUrl = `${AGENT_API_URL}/streams/task-executions/${executionId}`;
    const response = await fetch(sseUrl, {
      headers: {
        'Authorization': `Bearer ${auth.apiToken}`,
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SSE Proxy] Agent-server error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Failed to connect to execution stream: ${response.statusText}`,
          details: errorText,
        }),
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Return SSE stream with proper headers
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error: any) {
    console.error('[SSE Proxy] Failed to establish execution stream:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to establish stream connection',
        details: error.message,
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
