/**
 * Enhanced Chat Client for busibox-app
 * 
 * Client for the new chat architecture with conversation history,
 * tool execution, agent orchestration, and insights generation.
 * 
 * Usage:
 * ```typescript
 * // Send a message
 * const response = await sendChatMessage({
 *   message: "Hello!",
 *   model: "auto",
 *   enable_web_search: true
 * });
 * 
 * // Stream a message
 * for await (const event of streamChatMessage({
 *   message: "Tell me about AI",
 *   model: "auto"
 * })) {
 *   if (event.type === 'content_chunk') {
 *     console.log(event.data.content);
 *   }
 * }
 * ```
 */

import type {
  Conversation,
  Message,
  ChatMessageRequest,
  ChatMessageResponse,
  ModelCapabilities,
  ChatInsight,
  InsightSearchResult,
} from '../../types/chat';

import { agentApiFetch, getAgentApiUrl } from './agent-api-base';

export interface ChatClientOptions {
  /** Agent API base URL override */
  agentUrl?: string;
  /** Authorization token */
  token?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Resolve a chat endpoint to a full URL, respecting agentUrl override.
 * When agentUrl is provided, build the full URL so agentApiFetch treats
 * it as an absolute URL and skips its own getAgentApiUrl().
 */
function resolveEndpoint(endpoint: string, agentUrl?: string): string {
  if (endpoint.startsWith('http')) return endpoint;
  if (agentUrl) {
    const path = `${agentUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    if (path.startsWith('http')) return path;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
    }
    return path;
  }
  return endpoint;
}

/**
 * Fetch helper for chat API calls. Delegates to the shared agentApiFetch
 * while preserving the agentUrl override and ChatClientOptions interface.
 */
async function chatFetch(
  endpoint: string,
  options: ChatClientOptions & RequestInit
): Promise<Response> {
  const { agentUrl, token, timeout = 30000, signal, ...fetchOptions } = options;
  return agentApiFetch(resolveEndpoint(endpoint, agentUrl), {
    token,
    timeout,
    signal: signal ?? undefined,
    ...fetchOptions,
  });
}

/**
 * Send a chat message (non-streaming)
 */
export async function sendChatMessage(
  request: ChatMessageRequest,
  options: ChatClientOptions = {}
): Promise<ChatMessageResponse> {
  const response = await chatFetch('/chat/message', {
    ...options,
    method: 'POST',
    body: JSON.stringify(request),
  });

  return response.json();
}

/**
 * Stream a chat message (Server-Sent Events)
 */
export async function* streamChatMessage(
  request: ChatMessageRequest,
  options: ChatClientOptions = {}
): AsyncGenerator<{ type: string; data: any }> {
  const response = await chatFetch('/chat/message/stream', {
    ...options,
    method: 'POST',
    body: JSON.stringify(request),
  });

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data && eventType) {
            try {
              yield { type: eventType, data: JSON.parse(data) };
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stream a chat message using the agentic dispatcher (Server-Sent Events)
 * 
 * This provides a more interactive experience with real-time thoughts and tool progress.
 * 
 * Event types:
 * - thought: Dispatcher/agent reasoning (for collapsible thinking section)
 * - tool_start: Starting a tool execution
 * - tool_result: Tool completed with result
 * - content: Final response content (streams to chat message)
 * - complete: Execution finished
 * - error: Error occurred
 * - conversation_created: New conversation was created
 * - message_complete: Message saved to database
 */
export async function* streamChatMessageAgentic(
  request: ChatMessageRequest,
  options: ChatClientOptions = {}
): AsyncGenerator<{ type: string; data: any }> {
  const response = await chatFetch('/chat/message/stream/agentic', {
    ...options,
    method: 'POST',
    body: JSON.stringify(request),
    timeout: 120000, // Longer timeout for agentic operations
  });

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = '';

  try {
    while (true) {
      // Check for abort
      if (options.signal?.aborted) {
        break;
      }
      
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data && eventType) {
            try {
              yield { type: eventType, data: JSON.parse(data) };
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get list of available models
 */
export async function getAvailableModels(
  options: ChatClientOptions = {}
): Promise<ModelCapabilities[]> {
  const response = await chatFetch('/chat/models', {
    ...options,
    method: 'GET',
  });

  const data = await response.json();
  return data.models || [];
}

/**
 * Get conversation history
 */
export async function getConversationHistory(
  conversationId: string,
  options: ChatClientOptions & { limit?: number; offset?: number } = {}
): Promise<Message[]> {
  const { limit, offset, ...clientOptions } = options;
  const params = new URLSearchParams();
  if (limit) params.append('limit', String(limit));
  if (offset) params.append('offset', String(offset));

  const response = await chatFetch(
    `/chat/${conversationId}/history${params.toString() ? `?${params}` : ''}`,
    {
      ...clientOptions,
      method: 'GET',
    }
  );

  const data = await response.json();
  return data.messages || [];
}

/**
 * Generate insights for a conversation
 */
export async function generateInsights(
  conversationId: string,
  options: ChatClientOptions = {}
): Promise<{ count: number; insights: ChatInsight[] }> {
  const response = await chatFetch(`/chat/${conversationId}/generate-insights`, {
    ...options,
    method: 'POST',
  });

  return response.json();
}

/**
 * Get all conversations for the current user
 */
export async function getConversations(
  options: ChatClientOptions & { limit?: number; offset?: number } = {}
): Promise<Conversation[]> {
  const { limit, offset, ...clientOptions } = options;
  const params = new URLSearchParams();
  if (limit) params.append('limit', String(limit));
  if (offset) params.append('offset', String(offset));

  const response = await chatFetch(
    `/conversations${params.toString() ? `?${params}` : ''}`,
    {
      ...clientOptions,
      method: 'GET',
    }
  );

  const data = await response.json();
  return data.conversations || [];
}

/**
 * Create a new conversation
 */
export async function createConversation(
  title?: string,
  options: ChatClientOptions = {}
): Promise<Conversation> {
  const response = await chatFetch('/conversations', {
    ...options,
    method: 'POST',
    body: JSON.stringify({ title }),
  });

  return response.json();
}

/**
 * Update a conversation
 */
export async function updateConversation(
  conversationId: string,
  updates: { title?: string; metadata?: Record<string, any> },
  options: ChatClientOptions = {}
): Promise<Conversation> {
  const response = await chatFetch(`/conversations/${conversationId}`, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(updates),
  });

  return response.json();
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  conversationId: string,
  options: ChatClientOptions = {}
): Promise<void> {
  await chatFetch(`/conversations/${conversationId}`, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * Search insights for the current user
 */
export async function searchInsights(
  query: string,
  options: ChatClientOptions & { limit?: number; conversationId?: string } = {}
): Promise<InsightSearchResult[]> {
  const { limit, conversationId, ...clientOptions } = options;

  const response = await chatFetch('/insights/search', {
    ...clientOptions,
    method: 'POST',
    body: JSON.stringify({
      query,
      limit: limit || 10,
      conversation_id: conversationId,
    }),
  });

  const data = await response.json();
  return data.results || [];
}

/**
 * Insert insights manually
 */
export async function insertInsights(
  insights: Omit<ChatInsight, 'id' | 'createdAt'>[],
  options: ChatClientOptions = {}
): Promise<{ count: number }> {
  const response = await chatFetch('/insights', {
    ...options,
    method: 'POST',
    body: JSON.stringify({ insights }),
  });

  return response.json();
}

/**
 * Delete insights for a conversation
 */
export async function deleteConversationInsights(
  conversationId: string,
  options: ChatClientOptions = {}
): Promise<{ count: number }> {
  const response = await chatFetch(`/insights/conversation/${conversationId}`, {
    ...options,
    method: 'DELETE',
  });

  return response.json();
}

/**
 * Get insight statistics
 */
export async function getInsightStats(
  options: ChatClientOptions = {}
): Promise<{ total: number; by_category: Record<string, number>; by_source: Record<string, number> }> {
  const response = await chatFetch('/insights/stats/me', {
    ...options,
    method: 'GET',
  });

  return response.json();
}

/**
 * Initialize insights collection (admin only)
 */
export async function initializeInsights(
  options: ChatClientOptions = {}
): Promise<{ success: boolean; collection: string }> {
  const response = await chatFetch('/insights/init', {
    ...options,
    method: 'POST',
  });

  return response.json();
}

