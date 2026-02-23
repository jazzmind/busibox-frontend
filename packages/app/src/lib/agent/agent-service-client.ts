/**
 * Server-side Agent API Client
 * 
 * Factory-pattern client for Server Components and Server Actions.
 * Wraps agent-api-base with a getAuthToken callback and camelCase mapping.
 * 
 * Usage:
 * ```typescript
 * const client = createAgentClient({
 *   agentUrl: 'http://internal-agent-api:8000',
 *   getAuthToken: async () => getServerAuthToken(userId),
 * });
 * 
 * const agents = await client.getAgents();
 * const conversations = await client.getConversations();
 * ```
 */

import type {
  Conversation,
  Message,
  ChatMessageRequest,
  ChatMessageResponse,
  ChatInsight,
  InsightSearchResult,
} from '../../types/chat';

import { agentApiFetch, agentApiFetchJson } from './agent-api-base';

export interface AgentClientConfig {
  /** Agent API base URL (used to build absolute URLs so base skips its own resolution) */
  agentUrl: string;
  /** Function to get auth token for requests */
  getAuthToken: () => Promise<string>;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  display_name: string;
  description: string;
  model: string;
  is_builtin: boolean;
  is_active: boolean;
  tools?: { names: string[] };
}

export interface ToolDefinition {
  name: string;
  description: string;
  enabled: boolean;
}

/**
 * Create a server-side agent API client
 */
export function createAgentClient(config: AgentClientConfig) {
  const { agentUrl, getAuthToken, timeout = 30000 } = config;

  function fullUrl(endpoint: string): string {
    return `${agentUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  async function fetchJson<T>(endpoint: string, init?: RequestInit): Promise<T> {
    const token = await getAuthToken();
    return agentApiFetchJson<T>(fullUrl(endpoint), {
      token,
      timeout,
      cache: 'no-store' as RequestCache,
      ...init,
    });
  }

  async function fetchRaw(endpoint: string, init?: RequestInit): Promise<Response> {
    const token = await getAuthToken();
    return agentApiFetch(fullUrl(endpoint), {
      token,
      timeout,
      cache: 'no-store' as RequestCache,
      ...init,
    });
  }

  return {
    async getAgents(): Promise<AgentDefinition[]> {
      return fetchJson('/agents');
    },

    async getTools(): Promise<ToolDefinition[]> {
      return [
        { name: 'web_search', description: 'Search the web for current information', enabled: true },
        { name: 'doc_search', description: 'Search your document libraries', enabled: true },
      ];
    },

    async getConversations(options?: { limit?: number; offset?: number; source?: string }): Promise<Conversation[]> {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));
      if (options?.source) params.set('source', options.source);

      const data = await fetchJson<any>(`/conversations${params.toString() ? `?${params}` : ''}`);
      const conversations = data.conversations || data || [];

      return conversations.map((conv: any) => ({
        id: conv.id,
        userId: conv.user_id,
        title: conv.title,
        source: conv.source,
        createdAt: new Date(conv.created_at),
        updatedAt: new Date(conv.updated_at),
        lastMessageAt: conv.last_message?.created_at ? new Date(conv.last_message.created_at) : undefined,
        messageCount: conv.message_count || 0,
        model: conv.model,
        metadata: conv.metadata,
      }));
    },

    async getConversation(conversationId: string): Promise<Conversation & { messages: Message[] }> {
      return fetchJson(`/conversations/${conversationId}`);
    },

    async createConversation(title?: string, source?: string): Promise<Conversation> {
      const conv = await fetchJson<any>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: title || 'New Conversation', source }),
      });

      return {
        id: conv.id,
        userId: conv.user_id,
        title: conv.title,
        source: conv.source,
        createdAt: new Date(conv.created_at),
        updatedAt: new Date(conv.updated_at),
        messageCount: conv.message_count || 0,
        model: conv.model,
        metadata: conv.metadata,
      };
    },

    async deleteConversation(conversationId: string): Promise<void> {
      await fetchJson(`/conversations/${conversationId}`, { method: 'DELETE' });
    },

    async updateConversation(
      conversationId: string,
      updates: { title?: string }
    ): Promise<Conversation> {
      return fetchJson(`/conversations/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async getMessages(
      conversationId: string,
      options?: { limit?: number }
    ): Promise<Message[]> {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));

      const data = await fetchJson<any>(
        `/chat/${conversationId}/history${params.toString() ? `?${params}` : ''}`
      );
      return data.messages || [];
    },

    async sendMessage(request: ChatMessageRequest): Promise<ChatMessageResponse> {
      return fetchJson('/chat/message', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    async streamMessage(request: ChatMessageRequest): Promise<Response> {
      return fetchRaw('/chat/message/stream', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    async generateInsights(conversationId: string): Promise<{ count: number; insights: ChatInsight[] }> {
      return fetchJson(`/chat/${conversationId}/generate-insights`, {
        method: 'POST',
      });
    },

    async searchInsights(
      query: string,
      options?: { limit?: number; conversationId?: string }
    ): Promise<InsightSearchResult[]> {
      const data = await fetchJson<any>('/insights/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit: options?.limit || 10,
          conversation_id: options?.conversationId,
        }),
      });
      return data.results || [];
    },

    async getInsightStats(): Promise<{
      total: number;
      by_category: Record<string, number>;
      by_source: Record<string, number>;
    }> {
      return fetchJson('/insights/stats/me');
    },

    async insertInsights(insights: Omit<ChatInsight, 'id' | 'createdAt'>[]): Promise<{ count: number }> {
      return fetchJson('/insights', {
        method: 'POST',
        body: JSON.stringify({ insights }),
      });
    },

    async deleteConversationInsights(conversationId: string): Promise<{ count: number }> {
      return fetchJson(`/insights/conversation/${conversationId}`, {
        method: 'DELETE',
      });
    },
  };
}

export type AgentClient = ReturnType<typeof createAgentClient>;
