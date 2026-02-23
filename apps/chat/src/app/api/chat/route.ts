/**
 * Chat API Route
 * 
 * POST /api/chat - Stream chat completions from liteLLM
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, parseJsonBody, validateRequiredFields } from '@jazzmind/busibox-app/lib/next/middleware';
import OpenAI from 'openai';

// Initialize OpenAI client pointing to liteLLM
const litellm = new OpenAI({
  apiKey: process.env.LITELLM_API_KEY || 'sk-litellm-master-key-change-me',
  baseURL: process.env.LITELLM_BASE_URL || 'http://localhost:4000/v1',
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const body = await parseJsonBody(request);
    const validationError = validateRequiredFields(body, ['messages']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { messages, model = 'llama3-8b' } = body;

    // Validate messages format
    if (!Array.isArray(messages) || messages.length === 0) {
      return apiError('Messages must be a non-empty array', 400);
    }

    // Stream the response from liteLLM
    const stream = await litellm.chat.completions.create({
      model,
      messages,
      stream: true,
      temperature: 0.7,
    });

    // Create a ReadableStream that forwards the OpenAI stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          console.error('[CHAT] Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    console.error('[CHAT] Error:', error);
    
    // Handle specific liteLLM errors
    if (error.message?.includes('ECONNREFUSED')) {
      return apiError('Could not connect to liteLLM. Is it running?', 503);
    }
    
    if (error.message?.includes('model')) {
      return apiError(`Model error: ${error.message}`, 400);
    }

    return apiError('An unexpected error occurred', 500);
  }
}

