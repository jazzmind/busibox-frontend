/**
 * Agent API Client for Chat Operations
 * 
 * Provides typed HTTP calls to agent-api conversation, message, sharing,
 * and attachment endpoints. Used by the chat lib modules to replace Prisma.
 */

import { agentApiFetchJson, getAgentApiToken } from './agent-api-base';

export { getAgentApiToken };

// ---------------------------------------------------------------------------
// Base Request Helper (delegates to agent-api-base)
// ---------------------------------------------------------------------------

export async function agentApiRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return agentApiFetchJson<T>(path, { token, ...init });
}

// ---------------------------------------------------------------------------
// Types (mirror agent-api Pydantic schemas)
// ---------------------------------------------------------------------------

export interface AgentConversation {
  id: string;
  title: string;
  user_id: string;
  source?: string;
  model?: string;
  is_private: boolean;
  agent_id?: string;
  message_count?: number;
  last_message?: {
    role: string;
    content: string;
    created_at: string;
  };
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  attachments?: Array<{
    name: string;
    type: string;
    url: string;
    size: number;
    knowledge_base_id?: string;
  }>;
  metadata?: {
    web_search_results?: unknown;
    doc_search_results?: unknown;
    used_insight_ids?: string[];
    [key: string]: unknown;
  };
  run_id?: string;
  routing_decision?: Record<string, unknown>;
  tool_calls?: Array<Record<string, unknown>>;
  chat_attachments?: AgentChatAttachment[];
  created_at: string;
}

export interface AgentConversationShare {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  shared_by: string;
  shared_at: string;
}

export interface AgentChatAttachment {
  id: string;
  message_id?: string;
  file_id?: string;
  filename: string;
  file_url: string;
  mime_type?: string;
  size_bytes?: number;
  added_to_library: boolean;
  library_document_id?: string;
  parsed_content?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Conversation CRUD
// ---------------------------------------------------------------------------

export async function listConversations(
  token: string,
  opts: {
    limit?: number;
    offset?: number;
    order_by?: string;
    order?: string;
    source?: string;
    agent_id?: string;
  } = {},
): Promise<{ conversations: AgentConversation[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  if (opts.order_by) params.set('order_by', opts.order_by);
  if (opts.order) params.set('order', opts.order);
  if (opts.source) params.set('source', opts.source);
  if (opts.agent_id) params.set('agent_id', opts.agent_id);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return agentApiRequest(token, `/conversations${qs}`);
}

export async function createConversation(
  token: string,
  data: {
    title?: string;
    source?: string;
    model?: string;
    is_private?: boolean;
    agent_id?: string;
  },
): Promise<AgentConversation> {
  return agentApiRequest(token, '/conversations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getConversation(
  token: string,
  conversationId: string,
  opts: { include_messages?: boolean; message_limit?: number; message_offset?: number } = {},
): Promise<AgentConversation & { messages?: AgentMessage[] }> {
  const params = new URLSearchParams();
  if (opts.include_messages !== undefined) params.set('include_messages', String(opts.include_messages));
  if (opts.message_limit) params.set('message_limit', String(opts.message_limit));
  if (opts.message_offset) params.set('message_offset', String(opts.message_offset));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return agentApiRequest(token, `/conversations/${conversationId}${qs}`);
}

export async function updateConversation(
  token: string,
  conversationId: string,
  data: { title?: string; is_private?: boolean; model?: string },
): Promise<AgentConversation> {
  return agentApiRequest(token, `/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteConversation(token: string, conversationId: string): Promise<void> {
  await agentApiRequest(token, `/conversations/${conversationId}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Message CRUD
// ---------------------------------------------------------------------------

export async function listMessages(
  token: string,
  conversationId: string,
  opts: { limit?: number; offset?: number; order?: string } = {},
): Promise<{ messages: AgentMessage[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  if (opts.order) params.set('order', opts.order);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return agentApiRequest(token, `/conversations/${conversationId}/messages${qs}`);
}

export async function createMessage(
  token: string,
  conversationId: string,
  data: {
    role: string;
    content: string;
    attachments?: Array<{ name: string; type: string; url: string; size: number; knowledge_base_id?: string }>;
    metadata?: Record<string, unknown>;
    run_id?: string;
    routing_decision?: Record<string, unknown>;
    tool_calls?: Array<Record<string, unknown>>;
    attachment_ids?: string[];
  },
): Promise<AgentMessage> {
  return agentApiRequest(token, `/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMessage(token: string, messageId: string): Promise<AgentMessage> {
  return agentApiRequest(token, `/messages/${messageId}`);
}

export async function deleteMessage(token: string, conversationId: string, messageId: string): Promise<void> {
  await agentApiRequest(token, `/chat/${conversationId}/messages/${messageId}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Conversation Sharing
// ---------------------------------------------------------------------------

export async function shareConversation(
  token: string,
  conversationId: string,
  userId: string,
  role: string = 'viewer',
): Promise<AgentConversationShare> {
  return agentApiRequest(token, `/conversations/${conversationId}/shares`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role }),
  });
}

export async function listConversationShares(
  token: string,
  conversationId: string,
): Promise<{ shares: AgentConversationShare[] }> {
  return agentApiRequest(token, `/conversations/${conversationId}/shares`);
}

export async function unshareConversation(
  token: string,
  conversationId: string,
  userId: string,
): Promise<void> {
  await agentApiRequest(token, `/conversations/${conversationId}/shares/${userId}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Chat Attachments
// ---------------------------------------------------------------------------

export async function createChatAttachment(
  token: string,
  data: {
    filename: string;
    file_url: string;
    file_id?: string;
    mime_type?: string;
    size_bytes?: number;
    added_to_library?: boolean;
    library_document_id?: string;
    parsed_content?: string;
  },
): Promise<AgentChatAttachment> {
  return agentApiRequest(token, '/chat-attachments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getChatAttachment(token: string, attachmentId: string): Promise<AgentChatAttachment> {
  return agentApiRequest(token, `/chat-attachments/${attachmentId}`);
}

export async function deleteChatAttachment(token: string, attachmentId: string): Promise<void> {
  await agentApiRequest(token, `/chat-attachments/${attachmentId}`, { method: 'DELETE' });
}

export async function listChatAttachments(
  token: string,
  opts?: { message_id?: string | null; created_before?: string },
): Promise<{ attachments: AgentChatAttachment[] }> {
  const params = new URLSearchParams();
  if (opts?.message_id !== undefined) {
    params.set('message_id', opts.message_id === null ? 'null' : opts.message_id);
  }
  if (opts?.created_before) params.set('created_before', opts.created_before);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return agentApiRequest(token, `/chat-attachments${qs}`);
}
