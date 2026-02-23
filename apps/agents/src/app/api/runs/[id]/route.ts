import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders } from '@jazzmind/busibox-app/lib/authz/auth-helper';
import { getAgentApiUrl } from '@jazzmind/busibox-app/lib/agent/server-client';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

const AGENT_API_URL = getAgentApiUrl();

export async function GET(
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
    
    const response = await fetch(`${AGENT_API_URL}/runs/${id}`, {
      headers,
    });
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: 'Failed to fetch run', detail: error },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching run:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
