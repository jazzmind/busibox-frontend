import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '@jazzmind/busibox-app/lib/authz/auth-helper';
import { getAgentApiUrl } from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

const AGENT_API_URL = getAgentApiUrl();

/**
 * POST /api/tasks/[id]/executions/[execId]/stop
 * 
 * Stop a running or pending task execution.
 * Also stops the linked workflow execution if present.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; execId: string }> }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { id, execId } = await params;
    const headers = getAuthHeaders(auth.apiToken);
    
    const response = await fetch(
      `${AGENT_API_URL}/tasks/${id}/executions/${execId}/stop`,
      { method: 'POST', headers }
    );
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: 'Failed to stop execution', detail: error },
        { status: response.status }
      );
    }
    
    const execution = await response.json();
    return NextResponse.json(execution);
  } catch (error) {
    console.error('Error stopping execution:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
