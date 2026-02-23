/**
 * Agent API Catch-All Proxy
 *
 * Proxies all /api/agent/* requests to the internal agent API.
 * This allows the browser to call the agent API without direct access to internal IPs.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthorizationHeaderWithSession } from '@jazzmind/busibox-app/lib/authz/next-client';

// Agent API URL - for this proxy, we need the direct URL without path prefix
// The nginx at https://localhost/api/agent proxies to agent-api:8000
// So we should call the agent-api directly, not through nginx (which would double-proxy)
const AGENT_API_URL =
  process.env.AGENT_API_URL ||
  (process.env.AGENT_HOST
    ? `http://${process.env.AGENT_HOST}:${process.env.AGENT_API_PORT || 8000}`
    : 'http://localhost:8000');

async function proxyToAgentAPI(request: NextRequest, method: string, path: string[]) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user } = authResult;

    // Get session JWT for Zero Trust exchange
    const sessionJwt = getSessionJwt(request);
    if (!sessionJwt) {
      return apiError('Missing session JWT', 401);
    }

    // Get agent API token using Zero Trust (no client credentials)
    const authHeader = await getAuthorizationHeaderWithSession({
      sessionJwt,
      userId: user.id,
      audience: 'agent-api',
      scopes: [],
      purpose: 'agent-proxy',
    });

    // Build target URL
    const targetPath = path.join('/');
    const url = new URL(`${AGENT_API_URL}/${targetPath}`);
    const isStreamEndpoint = path.includes('stream');
    
    // Copy query parameters
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    // Prepare request options
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': authHeader,
        ...(isStreamEndpoint ? { 'Accept': 'text/event-stream' } : {}),
      },
      cache: 'no-store',
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
      return apiError(`Agent API error: ${errorText}`, response.status);
    }

    // Check if response is streaming (explicit stream endpoint or streaming headers)
    const contentType = response.headers.get('Content-Type') || '';
    const isStreaming = isStreamEndpoint ||
                       contentType.includes('text/event-stream') || 
                       contentType.includes('stream') ||
                       response.headers.get('Transfer-Encoding') === 'chunked';

    if (isStreaming) {
      // Stream the response back to the client
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Handle 204 No Content (e.g., DELETE responses)
    if (response.status === 204) {
      return new Response(null, { status: 204 });
    }

    // For non-streaming responses, parse and return JSON
    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[AGENT PROXY] Error:', error);
    return apiError(error.message || 'Failed to proxy request to agent API', 500);
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


