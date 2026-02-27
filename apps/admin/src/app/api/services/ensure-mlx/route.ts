/**
 * GET /api/services/ensure-mlx
 * 
 * Proxies MLX ensure endpoint to deploy-api.
 * This ensures MLX server is running before LLM validation.
 * Should only be called on Apple Silicon (backend=mlx).
 */

import { NextRequest } from 'next/server';
import { getCurrentUserWithSessionFromCookies, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

// Deploy API URL
const DEPLOY_API_URL = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Helper to send SSE event
function sseEvent(type: string, message: string, done: boolean = false): string {
  return `data: ${JSON.stringify({ type, message, done })}\n\n`;
}

export async function GET(request: NextRequest) {
  // Authentication
  const userWithSession = await getCurrentUserWithSessionFromCookies();
  if (!userWithSession || !requireAdmin(userWithSession)) {
    return new Response(
      sseEvent('error', 'Admin access required', true),
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

  const { sessionJwt } = userWithSession;

  // Create a streaming response that proxies from deploy-api
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Proxy the SSE stream from deploy-api
  (async () => {
    try {
      await writer.write(encoder.encode(sseEvent('info', 'Connecting to deploy service...')));
      
      // Exchange token for deploy-api access
      let adminToken = sessionJwt;
      try {
        const exchangeResult = await exchangeTokenZeroTrust(
          {
            sessionJwt,
            audience: 'deploy-api',
            scopes: ['admin', 'services:read'],
            purpose: 'Ensure MLX server',
          },
          {
            authzBaseUrl: AUTHZ_BASE_URL,
            verbose: false,
          }
        );
        adminToken = exchangeResult.accessToken;
      } catch (error) {
        console.warn('[API/ensure-mlx] Token exchange error, using session JWT:', error);
        // Continue with session JWT - deploy-api may still accept it
      }
      
      // Call deploy-api's MLX setup endpoint which handles first-time install
      // (deps, model download, server start) as well as idempotent re-runs.
      const response = await fetch(`${DEPLOY_API_URL}/api/v1/services/mlx/setup`, {
        headers: {
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${adminToken}`,
        },
        signal: AbortSignal.timeout(600000), // 10 minute timeout (deps + model download)
      });

      if (!response.ok) {
        const errorText = await response.text();
        await writer.write(encoder.encode(sseEvent('error', `Deploy API error: ${response.status} - ${errorText}`, true)));
        await writer.close();
        return;
      }

      if (!response.body) {
        await writer.write(encoder.encode(sseEvent('error', 'No response body from deploy API', true)));
        await writer.close();
        return;
      }

      await writer.write(encoder.encode(sseEvent('info', 'Checking MLX server status...')));

      // Stream the response from deploy-api
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Forward the SSE data directly
        const chunk = decoder.decode(value, { stream: true });
        await writer.write(encoder.encode(chunk));
      }
      
      await writer.close();

    } catch (error: any) {
      console.error('MLX ensure proxy error:', error);
      try {
        await writer.write(encoder.encode(sseEvent('error', `MLX ensure error: ${error.message}`, true)));
        await writer.close();
      } catch (writeError) {
        // Stream may already be closed
        console.error('Failed to write error to stream:', writeError);
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
