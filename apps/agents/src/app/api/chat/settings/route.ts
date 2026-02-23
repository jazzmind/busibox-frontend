import { NextRequest, NextResponse } from 'next/server';
import * as agentClient from '@jazzmind/busibox-app/lib/agent/server-client';
import { getTokenFromRequest } from '@jazzmind/busibox-app/lib/authz/auth-helper';

/**
 * GET /api/chat/settings
 * Get user's chat settings from agent-server
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

    const settings = await agentClient.getChatSettings(token);
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('[API] Get settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get settings' },
      { status: error.statusCode || 500 }
    );
  }
}

/**
 * PUT /api/chat/settings
 * Update user's chat settings via agent-server
 */
export async function PUT(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const settings = await agentClient.updateChatSettings(body, token);
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error('[API] Update settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: error.statusCode || 500 }
    );
  }
}
