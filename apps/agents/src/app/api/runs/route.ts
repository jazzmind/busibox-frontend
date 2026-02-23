import { NextRequest, NextResponse } from 'next/server';
import * as agentClient from '@jazzmind/busibox-app/lib/agent/server-client';
import { getTokenFromRequest } from '@jazzmind/busibox-app/lib/authz/auth-helper';

/**
 * GET /api/runs
 * List runs with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    const { searchParams } = new URL(request.url);
    
    // Extract filter parameters
    const filters = {
      agent_id: searchParams.get('agent_id') || undefined,
      status: searchParams.get('status') || undefined,
      created_by: searchParams.get('created_by') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    };
    
    const runs = await agentClient.listRuns(filters, token);
    return NextResponse.json(runs);
  } catch (error: any) {
    console.error('[API] Failed to list runs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list runs' },
      { status: error.statusCode || 500 }
    );
  }
}

/**
 * POST /api/runs
 * Create a new run (execute agent)
 */
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    const body = await request.json();
    
    const run = await agentClient.createRun(body, token);
    return NextResponse.json(run, { status: 202 });
  } catch (error: any) {
    console.error('[API] Failed to create run:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create run' },
      { status: error.statusCode || 500 }
    );
  }
}
