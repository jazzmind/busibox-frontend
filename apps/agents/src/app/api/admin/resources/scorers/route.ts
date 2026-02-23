import { NextRequest, NextResponse } from 'next/server';
import * as agentClient from '@jazzmind/busibox-app/lib/agent/server-client';

function getTokenFromRequest(request: NextRequest): string | undefined {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const tokenCookie = request.cookies.get('auth_token');
  return tokenCookie?.value;
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    const evals = await agentClient.listEvals(token);
    return NextResponse.json(evals);
  } catch (error: any) {
    console.error('Failed to fetch evaluations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch evaluations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    const body = await request.json();
    const eval_def = await agentClient.createEval(body, token);
    return NextResponse.json(eval_def, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create evaluation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create evaluation' },
      { status: 500 }
    );
  }
}
