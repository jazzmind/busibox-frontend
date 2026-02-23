import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';
import { stopWorkflowExecution } from '@jazzmind/busibox-app/lib/agent/server-client';

// POST /api/workflows/executions/[id]/stop - Stop a running execution
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthWithTokenExchange(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const execution = await stopWorkflowExecution(id, auth.apiToken);
    return NextResponse.json(execution);
  } catch (error: any) {
    console.error('Error stopping execution:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to stop execution' },
      { status: error.status || 500 }
    );
  }
}
