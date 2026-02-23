import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { buildServiceAuthorization } from '../helpers';

const AGENT_API_URL = process.env.AGENT_API_URL 
  || (process.env.AGENT_HOST 
      ? `http://${process.env.AGENT_HOST}:8000`
      : 'https://localhost/api/agent');

/**
 * POST /api/tests/rag
 * 
 * Test RAG agent with document search
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user, sessionJwt } = authResult;
  const body = await request.json().catch(() => ({}));
  const query = body?.query || '';

  if (!query || typeof query !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Query is required' },
      { status: 400 }
    );
  }

  try {
    // Build authorization for search-api access
    const authorization = await buildServiceAuthorization(sessionJwt, user);

    // Call RAG agent via agent-server
    const response = await fetch(`${AGENT_API_URL}/api/agents/rag-search-agent/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: query,
          },
        ],
        // Pass auth context for document search tool
        toolContext: {
          authToken: authorization.replace('Bearer ', ''),
          userId: user.id,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin/tests/rag] Agent API error:', response.status, errorText);
      throw new Error(`Agent API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      data: {
        answer: data.text || data.content || '',
        toolCalls: data.toolCalls || [],
        model: data.model || 'unknown',
      },
    });
  } catch (error: any) {
    console.error('[admin/tests/rag] RAG agent failed', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'RAG agent failed' },
      { status: 500 }
    );
  }
}










