import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, getAuthHeaders } from '@jazzmind/busibox-app/lib/authz/auth-helper';
import { getAgentApiUrl } from '@jazzmind/busibox-app/lib/agent/server-client';

const baseUrl = getAgentApiUrl();

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    const authHeaders = getAuthHeaders(token);
    
    const response = await fetch(`${baseUrl}/api/resources/processors`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to fetch processors: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to fetch processors:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch processors' },
      { status: 500 }
    );
  }
}
