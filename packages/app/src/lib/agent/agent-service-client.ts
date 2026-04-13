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
  is_builtin?: boolean;
  scopes?: string[];
}

export type AgentVisibility = "builtin" | "application" | "shared" | "personal";

export interface AgentDefinitionInput {
  name: string;
  display_name: string;
  description: string;
  instructions: string;
  model: string;
  tools?: { names: string[] };
  workflows?: {
    execution_mode?: string;
    tool_strategy?: string;
    max_iterations?: number;
  };
  allow_frontier_fallback?: boolean;
  /**
   * @deprecated Use `visibility` instead. Kept for backward compat.
   * is_builtin=true without visibility maps to visibility='application' on the server.
   */
  is_builtin?: boolean;
  /** Agent visibility category. Preferred over is_builtin. */
  visibility?: AgentVisibility;
  /** Application ID — required when visibility='application'. */
  app_id?: string;
  scopes?: string[];
}

export interface AgentSyncResult {
  created: string[];
  updated: string[];
  failed: string[];
}

export interface AgentStatus {
  name: string;
  displayName: string;
  exists: boolean;
  inSync?: boolean;
  diffs?: string[];
}

export interface SyncStatus {
  agents: AgentStatus[];
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
      try {
        const tools = await fetchJson<any[]>('/agents/tools');
        return tools.map((t: any) => ({
          name: t.name,
          description: t.description || '',
          enabled: t.is_active !== false,
          is_builtin: t.is_builtin,
          scopes: t.scopes,
        }));
      } catch {
        return [];
      }
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

    async syncAgents(definitions: AgentDefinitionInput[]): Promise<AgentSyncResult> {
      const created: string[] = [];
      const updated: string[] = [];
      const failed: string[] = [];

      for (const agent of definitions) {
        try {
          const data = await fetchJson<any>('/agents/definitions', {
            method: 'POST',
            body: JSON.stringify(agent),
          });
          if (data.version && data.version > 1) {
            updated.push(agent.name);
          } else {
            created.push(agent.name);
          }
        } catch (err) {
          console.error(`[agent-sync] Failed to sync agent ${agent.name}:`, err instanceof Error ? err.message : err);
          failed.push(agent.name);
        }
      }

      return { created, updated, failed };
    },

    async getSyncStatus(definitions: AgentDefinitionInput[]): Promise<SyncStatus> {
      const agents: AgentStatus[] = [];

      try {
        const data = await fetchJson<any>('/agents');
        const items = data.items || data || [];
        const agentNames = Array.isArray(items)
          ? items.map((a: { name: string }) => a.name)
          : [];

        for (const def of definitions) {
          agents.push({
            name: def.name,
            displayName: def.display_name,
            exists: agentNames.includes(def.name),
          });
        }
      } catch {
        for (const def of definitions) {
          agents.push({ name: def.name, displayName: def.display_name, exists: false });
        }
      }

      return { agents };
    },
  };
}

export type AgentClient = ReturnType<typeof createAgentClient>;
