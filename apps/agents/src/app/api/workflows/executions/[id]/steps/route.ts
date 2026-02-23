import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';
import { getWorkflowExecutionSteps } from '@jazzmind/busibox-app/lib/agent/server-client';

// GET /api/workflows/executions/[id]/steps - Get step executions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthWithTokenExchange(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const steps = await getWorkflowExecutionSteps(id, auth.apiToken);
    return NextResponse.json(steps);
  } catch (error: any) {
    console.error('Error fetching execution steps:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch execution steps' },
      { status: error.status || 500 }
    );
  }
}
