import { NextRequest, NextResponse } from 'next/server';
import * as agentClient from '@jazzmind/busibox-app/lib/agent/server-client';
import { getTokenFromRequest } from '@jazzmind/busibox-app/lib/authz/auth-helper';

/**
 * GET /api/conversations
 * List user's conversations from agent-server
 * 
 * Query params:
 * - agent_id: Filter by agent ID (conversations where agent was used)
 * - limit: Number of conversations to return
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // Extract filter parameters
    const filters = {
      agent_id: searchParams.get('agent_id') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    };

    const conversations = await agentClient.listConversations(filters, token);
    return NextResponse.json(conversations);
  } catch (error: any) {
    console.error('[API] List conversations error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list conversations' },
      { status: error.statusCode || 500 }
    );
  }
}
