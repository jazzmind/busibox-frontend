/**
 * GET /api/services/start/[service]
 * 
 * SSE proxy for starting/installing a service via deploy-api.
 * EventSource doesn't support custom headers, so we proxy through here.
 * 
 * On Docker: Uses /api/v1/services/start/{service} (docker compose up)
 * On Proxmox: Uses /api/v1/services/install/{service} (Ansible playbooks)
 */

import { NextRequest } from 'next/server';
import { getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

// Cache platform info to avoid repeated calls during service installation
let cachedPlatformInfo: { backend: string; timestamp: number } | null = null;
const PLATFORM_CACHE_TTL = 60000; // 1 minute

async function getPlatformBackend(adminToken: string): Promise<string> {
  // Return cached value if still valid
  if (cachedPlatformInfo && Date.now() - cachedPlatformInfo.timestamp < PLATFORM_CACHE_TTL) {
    return cachedPlatformInfo.backend;
  }
  
  try {
    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/platform`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const platformInfo = await response.json();
      // Use deployment_backend (docker/proxmox/k8s), NOT backend (which is the LLM type: mlx/vllm/cloud)
      cachedPlatformInfo = {
        backend: platformInfo.deployment_backend || platformInfo.backend || 'docker',
        timestamp: Date.now(),
      };
      console.log(`[SSE Proxy] Deployment backend detected: ${cachedPlatformInfo.backend} (LLM backend: ${platformInfo.backend})`);
      return cachedPlatformInfo.backend;
    }
  } catch (error) {
    console.warn('[SSE Proxy] Failed to get platform info, defaulting to docker:', error);
  }
  
  return 'docker'; // Default to docker if platform detection fails
}

// Ensure this route is handled at runtime (not statically)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  // Create a response that always returns SSE format, even on errors
  const createSSEError = (message: string) => {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message, done: true })}\n\n`,
      { 
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  };

  try {
    console.log('[SSE Proxy] Route handler called, URL:', request.url);
    
    let service: string;
    try {
      const resolvedParams = await params;
      service = resolvedParams?.service;
      console.log(`[SSE Proxy] Service from params: ${service}`);
    } catch (paramsError) {
      console.error('[SSE Proxy] Error resolving params:', paramsError);
      // Try to extract from URL as fallback
      const urlParts = request.url.split('/');
      service = urlParts[urlParts.length - 1]?.split('?')[0];
      console.log(`[SSE Proxy] Service from URL fallback: ${service}`);
    }
    
    if (!service) {
      console.error('[SSE Proxy] No service parameter found');
      return createSSEError('Service name is required');
    }
    
    // Get user with roles from session JWT
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    console.log(`[SSE Proxy] User authenticated: ${!!userWithSession}`);
    
    if (!userWithSession) {
      console.error('[SSE Proxy] No user session');
      return createSSEError('Authentication required');
    }

    const { sessionJwt, ...user } = userWithSession;

    if (!requireAdmin(user)) {
      console.error('[SSE Proxy] User is not admin');
      return createSSEError('Admin access required');
    }

    // Exchange session token for admin-scoped token
    let adminToken = sessionJwt;
    
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'deployment:manage', 'services:manage'],
          purpose: 'Service deployment via SSE',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: true,
        }
      );
      
      adminToken = exchangeResult.accessToken;
    } catch (exchangeError) {
      // If the session is invalid (e.g., signing key changed), return SSE error
      if (isInvalidSessionError(exchangeError)) {
        console.error('[API/services/start] Session is invalid - user should log out:', exchangeError);
        return createSSEError('Your session is no longer valid. Please log in again.');
      }
      console.warn('[API/services/start] Token exchange error:', exchangeError);
      // Fall back to session token if exchange fails for other reasons
    }
    
    // Determine the correct endpoint based on platform
    // On Proxmox, we use /install to run Ansible playbooks
    // On Docker, we use /start to run docker compose up
    const backend = await getPlatformBackend(adminToken);
    const isProxmox = backend === 'proxmox';
    
    // Choose endpoint: /install for Proxmox (runs Ansible), /start for Docker (docker compose up)
    const endpoint = isProxmox ? 'install' : 'start';
    
    // Forward rebuild param from the client request
    const requestUrl = new URL(request.url);
    const rebuild = requestUrl.searchParams.get('rebuild');
    const extraParams = rebuild === 'true' ? '&rebuild=true' : '';
    const deployUrl = `${DEPLOY_API_BASE}/api/v1/services/${endpoint}/${service}?token=${adminToken}${extraParams}`;
    
    console.log(`[SSE Proxy] Platform: ${backend}, using /${endpoint} endpoint`);
    console.log(`[SSE Proxy] Proxying to: ${deployUrl.replace(/token=[^&]+/, 'token=***')}`);
    
    // SSE streams can be silent for 30s+ during image pulls, health waits, and init
    // containers. Node.js fetch (undici) has a 30s default bodyTimeout between chunks,
    // so we use AbortSignal with a generous 10-minute overall timeout instead.
    const response = await fetch(deployUrl, {
      headers: {
        'Accept': 'text/event-stream',
      },
      signal: AbortSignal.timeout(600_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[SSE Proxy] Deploy-api error: ${response.status} - ${errorText}`);
      return createSSEError(`Failed to start service: ${errorText}`);
    }

    // Check if response is actually SSE
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/event-stream')) {
      const body = await response.text();
      console.error(`[SSE Proxy] Unexpected content type: ${contentType}, body: ${body.substring(0, 200)}`);
      return createSSEError('Deploy-api did not return SSE stream');
    }

    // Return the SSE stream
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[SSE Proxy] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SSE Proxy] Error details:', { errorMessage, stack: error instanceof Error ? error.stack : undefined });
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: errorMessage, done: true })}\n\n`,
      { 
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  }
}
