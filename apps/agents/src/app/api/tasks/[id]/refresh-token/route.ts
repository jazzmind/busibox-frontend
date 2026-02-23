import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '@jazzmind/busibox-app/lib/authz/auth-helper';
import { getAgentApiUrl } from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

const AGENT_API_URL = getAgentApiUrl();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthWithTokenExchange(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { id } = await params;
    const headers = getAuthHeaders(auth.apiToken);
    
    const response = await fetch(`${AGENT_API_URL}/tasks/${id}/refresh-token`, {
      method: 'POST',
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return NextResponse.json(
        { error: 'Failed to refresh delegation token', detail: error.detail },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error refreshing delegation token:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
