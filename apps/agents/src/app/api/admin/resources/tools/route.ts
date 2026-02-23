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
    const tools = await agentClient.listTools(token);
    return NextResponse.json(tools);
  } catch (error: any) {
    console.error('Failed to fetch tools:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tools' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    const body = await request.json();
    const tool = await agentClient.createTool(body, token);
    return NextResponse.json(tool, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create tool:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tool' },
      { status: 500 }
    );
  }
}
