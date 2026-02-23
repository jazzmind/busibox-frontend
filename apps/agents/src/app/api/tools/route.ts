import { NextRequest, NextResponse } from 'next/server';
import * as agentClient from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

/**
 * Get agent-api token for server-side calls. Prefers session from cookie (same as agent proxy)
 * so that tools/list works when the user is logged in via Busibox Portal (busibox-session).
 */
async function getTokenForTools(request: NextRequest): Promise<string | null> {
  const auth = await requireAuthWithTokenExchange(request);
  if (auth instanceof NextResponse) return null;
  const token = auth?.apiToken?.trim();
  return token || null;
}

/**
 * GET /api/tools
 * List all tools. Requires valid session (cookie or token); forwards Bearer token to agent-api.
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getTokenForTools(request);
    if (!token) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in through Busibox Portal and try again. For local dev, set TEST_SESSION_JWT.',
        },
        { status: 401 }
      );
    }

    const tools = await agentClient.listTools(token);
    return NextResponse.json(tools);
  } catch (error: any) {
    console.error('[API] Failed to list tools:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list tools' },
      { status: error.statusCode || 500 }
    );
  }
}

/**
 * POST /api/tools
 * Create a new tool
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getTokenForTools(request);
    if (!token) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in through Busibox Portal and try again.',
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const tool = await agentClient.createTool(body, token);
    return NextResponse.json(tool, { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to create tool:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tool' },
      { status: error.statusCode || 500 }
    );
  }
}
