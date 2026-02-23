import { NextRequest, NextResponse } from 'next/server';
import * as agentClient from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

/**
 * GET /api/agents/[id]
 * Get agent details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Authenticate and exchange token
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) {
      return auth; // Return error response
    }
    
    // Note: agent-server doesn't have individual GET endpoint yet
    // So we list all and filter (or this will be added in agent-server-requirements.md)
    const agents = await agentClient.listAgents(auth.apiToken);
    const agent = agents.find((a: any) => a.id === id);
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(agent);
  } catch (error: any) {
    console.error('[API] Failed to get agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get agent' },
      { status: error.statusCode || 500 }
    );
  }
}
