import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';
import { listWorkflowExecutions } from '@jazzmind/busibox-app/lib/agent/server-client';

// GET /api/workflows/[id]/executions - List executions for a workflow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthWithTokenExchange(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const status = searchParams.get('status') || undefined;

    const executions = await listWorkflowExecutions(
      id,
      { limit, offset, status },
      auth.apiToken
    );

    return NextResponse.json(executions);
  } catch (error: any) {
    console.error('Error fetching executions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch executions' },
      { status: error.status || 500 }
    );
  }
}
