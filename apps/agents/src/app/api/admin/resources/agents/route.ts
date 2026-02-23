import { NextRequest, NextResponse } from 'next/server';
import * as agentClient from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

// List all agents
export async function GET(request: NextRequest) {
  try {
    // Authenticate and exchange token
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) {
      return auth; // Return error response
    }
    
    const agents = await agentClient.listAgents(auth.apiToken);
    return NextResponse.json(agents);
  } catch (error: any) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

// Create a new agent
export async function POST(request: NextRequest) {
  try {
    // Authenticate and exchange token
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) {
      return auth; // Return error response
    }
    
    const body = await request.json();
    const agent = await agentClient.createAgentDefinition(body, auth.apiToken);
    return NextResponse.json(agent, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create agent' },
      { status: 500 }
    );
  }
}
