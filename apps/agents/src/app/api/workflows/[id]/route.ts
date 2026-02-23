import { NextRequest, NextResponse } from 'next/server';
import * as agentClient from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

/**
 * GET /api/workflows/[id]
 * Get a single workflow
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) return auth; // Auth failed, return error response
    const { id } = await params;
    const workflow = await agentClient.getWorkflow(id, auth.apiToken);
    return NextResponse.json(workflow);
  } catch (error: any) {
    console.error('[API] Failed to get workflow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get workflow' },
      { status: error.statusCode || 500 }
    );
  }
}

/**
 * PUT /api/workflows/[id]
 * Update a workflow
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) return auth; // Auth failed, return error response
    const { id } = await params;
    const body = await request.json();
    
    const workflow = await agentClient.updateWorkflow(id, body, auth.apiToken);
    return NextResponse.json(workflow);
  } catch (error: any) {
    console.error('[API] Failed to update workflow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update workflow' },
      { status: error.statusCode || 500 }
    );
  }
}

/**
 * DELETE /api/workflows/[id]
 * Delete a workflow
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) return auth; // Auth failed, return error response
    const { id } = await params;
    await agentClient.deleteWorkflow(id, auth.apiToken);
    return NextResponse.json({ success: true }, { status: 204 });
  } catch (error: any) {
    console.error('[API] Failed to delete workflow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete workflow' },
      { status: error.statusCode || 500 }
    );
  }
}
