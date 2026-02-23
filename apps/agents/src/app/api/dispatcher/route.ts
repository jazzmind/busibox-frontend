import { NextRequest, NextResponse } from 'next/server';
import * as agentClient from '@jazzmind/busibox-app/lib/agent/server-client';
import { getTokenFromRequest } from '@jazzmind/busibox-app/lib/authz/auth-helper';

/**
 * POST /api/dispatcher/route
 * Route a query to appropriate tools and agents
 */
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const routingDecision = await agentClient.routeQuery(body, token);
    
    return NextResponse.json(routingDecision);
  } catch (error: any) {
    console.error('[API] Dispatcher error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to route query' },
      { status: error.statusCode || 500 }
    );
  }
}
