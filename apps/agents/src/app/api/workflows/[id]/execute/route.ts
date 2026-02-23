import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';
import { executeWorkflow } from '@jazzmind/busibox-app/lib/agent/server-client';

// POST /api/workflows/[id]/execute - Execute a workflow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthWithTokenExchange(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { input_data, guardrails } = body;

    const execution = await executeWorkflow(
      id,
      input_data || {},
      guardrails,
      auth.apiToken
    );

    return NextResponse.json(execution);
  } catch (error: any) {
    console.error('Error executing workflow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute workflow' },
      { status: error.status || 500 }
    );
  }
}
