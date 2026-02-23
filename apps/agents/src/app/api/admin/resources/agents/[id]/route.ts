import { NextRequest, NextResponse } from 'next/server';
import * as agentClient from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

// Update an agent
export async function PUT(
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

    const body = await request.json();
    const agent = await agentClient.updateAgentDefinition(id, body, auth.apiToken);
    return NextResponse.json(agent);
  } catch (error: any) {
    console.error('Failed to update agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update agent' },
      { status: error.statusCode || 500 }
    );
  }
}

// Delete an agent
export async function DELETE(
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

    await agentClient.deleteAgent(id, auth.apiToken);
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error('Failed to delete agent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete agent' },
      { status: error.statusCode || 500 }
    );
  }
}
