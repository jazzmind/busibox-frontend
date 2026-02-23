import { NextRequest, NextResponse } from 'next/server';
import * as agentClient from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

/**
 * GET /api/workflows
 * List all workflows
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) return auth; // Auth failed, return error response
    const workflows = await agentClient.listWorkflows(auth.apiToken);
    return NextResponse.json(workflows);
  } catch (error: any) {
    console.error('[API] Failed to list workflows:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list workflows' },
      { status: error.statusCode || 500 }
    );
  }
}

/**
 * POST /api/workflows
 * Create a new workflow
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) return auth; // Auth failed, return error response
    const body = await request.json();
    
    const workflow = await agentClient.createWorkflow(body, auth.apiToken);
    return NextResponse.json(workflow, { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to create workflow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create workflow' },
      { status: error.statusCode || 500 }
    );
  }
}
