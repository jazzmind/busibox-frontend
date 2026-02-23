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
    const models = await agentClient.listModels(token);
    return NextResponse.json(models);
  } catch (error: any) {
    console.error('Failed to fetch models:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
