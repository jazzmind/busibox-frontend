/**
 * Deployment Status SSE Stream
 * 
 * GET /api/apps/[appId]/deploy/[deploymentId]/stream
 * 
 * Server-Sent Events endpoint for real-time deployment status streaming.
 * Much more efficient than polling - receives updates as they happen.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import { getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';
import { updateAppConfig } from '@jazzmind/busibox-app/lib/deploy/app-config';

const DEPLOYMENT_SERVICE_URL = process.env.DEPLOYMENT_SERVICE_URL || 
  (process.env.NODE_ENV === 'production' ? 'http://10.96.200.210:8011/api/v1/deployment' : 'http://localhost:8011/api/v1/deployment');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string; deploymentId: string }> }
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user, sessionJwt } = authResult;
    const { appId, deploymentId } = await params;

    // Exchange session token for deploy-api scoped token
    const exchangeResult = await exchangeTokenZeroTrust(
      {
        sessionJwt,
        audience: 'deploy-api',
        scopes: ['admin', 'deploy:read'],
        purpose: 'Stream deployment status',
      },
      {
        authzBaseUrl: getAuthzBaseUrl(),
        verbose: false,
      }
    );
    const deployToken = exchangeResult.accessToken;

    // Create a readable stream that proxies the SSE from deploy-api
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;
        const safeClose = () => {
          if (isClosed) return;
          isClosed = true;
          try {
            controller.close();
          } catch {
            // Stream already closed/cancelled by client.
          }
        };
        const safeEnqueue = (payload: string): boolean => {
          if (isClosed) return false;
          try {
            controller.enqueue(encoder.encode(payload));
            return true;
          } catch {
            // Prevent "ERR_INVALID_STATE: Controller is already closed".
            isClosed = true;
            return false;
          }
        };

        try {
          // Connect to the deploy-api SSE endpoint
          const response = await fetch(
            `${DEPLOYMENT_SERVICE_URL}/deploy/${deploymentId}/stream`,
            {
              headers: {
                'Authorization': `Bearer ${deployToken}`,
                'Accept': 'text/event-stream',
              },
            }
          );

          if (!response.ok) {
            const error = await response.text();
            safeEnqueue(`event: error\ndata: ${JSON.stringify({ error: error || 'Failed to connect to deployment service' })}\n\n`);
            safeClose();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            safeEnqueue(`event: error\ndata: ${JSON.stringify({ error: 'No response body' })}\n\n`);
            safeClose();
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';

          // Read and forward the SSE stream
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }

            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete SSE messages (end with \n\n)
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || ''; // Keep incomplete message in buffer

            for (const message of messages) {
              if (message.trim()) {
                // Check if this is a "Deployment not found" error - convert to data message
                // so the client can handle retry logic
                if (message.includes('event: error') && message.includes('Deployment not found')) {
                  // Convert error event to regular data message for client retry handling
                  const dataMatch = message.match(/data: (.+)/);
                  if (dataMatch) {
                    if (!safeEnqueue(`data: ${dataMatch[1]}\n\n`)) {
                      break;
                    }
                  }
                  continue;
                }
                
                // Forward the message
                if (!safeEnqueue(message + '\n\n')) {
                  break;
                }

                // Parse and persist status if it's a data message
                try {
                  const dataMatch = message.match(/data: (.+)/);
                  if (dataMatch) {
                    const data = JSON.parse(dataMatch[1]);
                    
                    // Skip persisting if this is just an error (no status)
                    if (!data.status) continue;
                    
                    // Persist status to database
                    const isComplete = data.status === 'completed' || data.status === 'failed';
                    await updateAppConfig({ userId: user.id, sessionJwt }, appId, {
                      lastDeploymentStatus: data.status,
                      lastDeploymentLogs: JSON.stringify(data.logs || []),
                      lastDeploymentError: data.error || null,
                      ...(isComplete ? { lastDeploymentEndedAt: new Date() } : {}),
                    });
                  }
                } catch (parseError) {
                  // Ignore parse errors for non-JSON messages
                }
              }
            }
          }

          safeClose();
        } catch (error) {
          console.error('[SSE Stream] Error:', error);
          safeEnqueue(`event: error\ndata: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
          safeClose();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('[API] Deployment stream error:', error);
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Authentication failed' })}\n\n`));
        controller.close();
      },
    });
    return new Response(errorStream, {
      status: 401,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }
}
