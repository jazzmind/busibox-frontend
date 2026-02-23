import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '@jazzmind/busibox-app/lib/authz/auth-helper';
import { getAgentApiUrl } from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

const AGENT_API_URL = getAgentApiUrl();

/**
 * GET /api/tasks/[id]/executions/[execId]
 * 
 * Fetch a single task execution by ID with full details.
 */
export async function GET(
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
    
    // Fetch the specific execution
    const response = await fetch(
      `${AGENT_API_URL}/tasks/${id}/executions/${execId}`,
      { headers }
    );
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: 'Failed to fetch execution', detail: error },
        { status: response.status }
      );
    }
    
    const execution = await response.json();
    
    // If execution has a run_id, fetch run details too
    if (execution.run_id) {
      try {
        const runResponse = await fetch(
          `${AGENT_API_URL}/runs/${execution.run_id}`,
          { headers }
        );
        
        if (runResponse.ok) {
          const runDetails = await runResponse.json();
          execution.run_details = runDetails;
        }
      } catch (err) {
        console.error('Failed to fetch run details:', err);
        // Continue without run details
      }
    }
    
    return NextResponse.json(execution);
  } catch (error) {
    console.error('Error fetching execution:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/[id]/executions/[execId]
 * 
 * Delete a task execution (only terminal states: failed, stopped, completed, timeout).
 */
export async function DELETE(
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
      `${AGENT_API_URL}/tasks/${id}/executions/${execId}`,
      { method: 'DELETE', headers }
    );
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: 'Failed to delete execution', detail: error },
        { status: response.status }
      );
    }
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting execution:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
