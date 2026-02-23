import { NextRequest } from 'next/server';
import { requireToken } from '@jazzmind/busibox-app/lib/authz/auth-helper';

/**
 * POST /api/chat
 * Streaming chat endpoint used by @jazzmind/busibox-app `ChatInterface`.
 *
 * Proxies to agent-api /chat/message/stream endpoint with proper authentication.
 *
 * Request body (library contract):
 * - messages: Array<{ role: 'user'|'assistant'|'system', content: string }>
 * - model?: string
 * - agentId?: string (for agent-specific chat)
 *
 * Response:
 * - text/plain stream with content chunks from agent
 */
export async function POST(request: NextRequest) {
  try {
    // Get token from request (cookie or Authorization header)
    const token = requireToken(request);

    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const modelOverride = typeof body?.model === 'string' ? body.model : undefined;
    const agentId = typeof body?.agentId === 'string' ? body.agentId : undefined;

    // Get the last user message as the prompt
    const lastUser = [...messages].reverse().find((m: any) => m?.role === 'user' && typeof m?.content === 'string');
    const prompt = (lastUser?.content ?? '').trim();
    if (!prompt) {
      return new Response('Please enter a message.', { status: 400 });
    }

    // Build request payload for agent-api
    const payload: any = {
      conversation_id: body.conversationId || null,
      message: prompt,
      model: modelOverride || 'auto',
      enable_web_search: false,
      enable_doc_search: false,
    };

    // If agent ID provided, use it directly (bypass dispatcher)
    if (agentId) {
      payload.selected_agents = [agentId];
    }

    // Call agent-api chat endpoint
    const agentApiUrl = process.env.AGENT_API_URL || 'http://10.96.200.30:8000';
    const response = await fetch(`${agentApiUrl}/chat/message/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Chat stream error:', response.status, errorText);
      return new Response(JSON.stringify({ error: errorText || 'Chat request failed' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return the streaming response, converting SSE to plain text chunks
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process SSE events
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';

            for (const rawEvent of parts) {
              const lines = rawEvent.split('\n').map(l => l.trim());
              const eventLine = lines.find(l => l.startsWith('event:'));
              const dataLine = lines.find(l => l.startsWith('data:'));

              if (!eventLine || !dataLine) continue;

              const eventType = eventLine.split(':', 2)[1]?.trim();
              const dataStr = dataLine.slice('data:'.length).trim();

              // Handle content_chunk events - send raw text to client
              if (eventType === 'content_chunk' && dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  if (data.chunk) {
                    controller.enqueue(encoder.encode(data.chunk));
                  }
                } catch (e) {
                  console.error('[API] Failed to parse content_chunk:', e);
                }
              }

              // Handle errors
              if (eventType === 'error' && dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  controller.enqueue(encoder.encode(`\n\n❌ Error: ${data.error || dataStr}`));
                } catch {
                  controller.enqueue(encoder.encode(`\n\n❌ Error: ${dataStr}`));
                }
              }
            }
          }
        } catch (err: any) {
          console.error('[API] Stream processing error:', err);
          controller.enqueue(encoder.encode(`\n\n❌ Error: ${err.message}`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('[API] Chat error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to process chat message' }), {
      status: error.statusCode || 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
