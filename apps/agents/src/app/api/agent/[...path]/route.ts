/**
 * Agent API Catch-All Proxy
 *
 * Proxies all /api/agent/* requests to the internal agent API.
 * This allows the browser to call the agent API without direct access to internal IPs.
 * 
 * Used by SimpleChatInterface and other client-side components that need to 
 * communicate with the agent API.
 * 
 * Authentication:
 * - Uses the busibox-session cookie (not the Authorization header)
 * - Exchanges the session JWT for an agent-api token server-side
 * - The client doesn't need to pass any token - cookies are included automatically
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentApiUrl } from '@jazzmind/busibox-app/lib/agent/server-client';
import { getApiToken } from '@jazzmind/busibox-app/lib/authz/next-client';

// Get agent API URL (server-side uses internal IP)
const AGENT_API_URL = getAgentApiUrl();

async function proxyToAgentAPI(request: NextRequest, method: string, path: string[]) {
  try {
    // Get session token from cookie (busibox-session)
    // We explicitly use the cookie, NOT the Authorization header
    // This is because the client might pass an agent-api token in the header,
    // but we need the session token to exchange for a fresh agent-api token
    const sessionCookie = request.cookies.get('busibox-session');
    
    if (!sessionCookie?.value) {
      // Try TEST_SESSION_JWT for local development
      const testSessionJwt = process.env.TEST_SESSION_JWT;
      if (!testSessionJwt) {
        return NextResponse.json(
          { error: 'Authentication required', message: 'Please log in through Busibox Portal' },
          { status: 401 }
        );
      }
      
      // Use test token
      const apiToken = await getApiToken(testSessionJwt, 'agent-api');
      return await forwardRequest(request, method, path, apiToken);
    }
    
    // Exchange session token for agent-api token
    const apiToken = await getApiToken(sessionCookie.value, 'agent-api');
    return await forwardRequest(request, method, path, apiToken);
  } catch (error: any) {
    console.error('[AGENT PROXY] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to proxy request to agent API' },
      { status: 500 }
    );
  }
}

async function forwardRequest(
  request: NextRequest,
  method: string,
  path: string[],
  apiToken: string
) {
  try {
    // Build target URL
    const targetPath = path.join('/');
    const url = new URL(`${AGENT_API_URL}/${targetPath}`);
    
    // Copy query parameters
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    // Prepare request options
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    };

    // Add body for non-GET requests
    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        try {
          const body = await request.json();
          options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
          };
          options.body = JSON.stringify(body);
        } catch (e) {
          // If JSON parsing fails, just pass through
        }
      } else if (contentType) {
        options.headers = {
          ...options.headers,
          'Content-Type': contentType,
        };
        options.body = await request.text();
      }
    }

    console.log('[AGENT PROXY] Forwarding:', method, targetPath);

    // Forward request to agent API
    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AGENT PROXY] Agent API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Agent API error: ${errorText}` },
        { status: response.status }
      );
    }

    // Check if response is streaming (text/event-stream or chunked)
    const contentType = response.headers.get('Content-Type') || '';
    const isStreaming = contentType.includes('text/event-stream') || 
                       contentType.includes('stream') ||
                       response.headers.get('Transfer-Encoding') === 'chunked';

    if (isStreaming) {
      // Stream the response back to the client
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Handle 204 No Content (e.g., DELETE responses)
    if (response.status === 204) {
      return new Response(null, { status: 204 });
    }

    // For non-streaming responses, parse and return JSON
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[AGENT PROXY] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to proxy request to agent API' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToAgentAPI(request, 'GET', path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToAgentAPI(request, 'POST', path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToAgentAPI(request, 'PUT', path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToAgentAPI(request, 'PATCH', path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToAgentAPI(request, 'DELETE', path);
}
