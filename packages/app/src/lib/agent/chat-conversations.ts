/**
 * Conversation Service
 *
 * Business logic for conversation management.
 * Uses agent-api HTTP client instead of Prisma.
 * All functions require an agent-api access token as the first parameter.
 */

import {
  listConversations,
  createConversation as agentCreateConversation,
  getConversation as agentGetConversation,
  updateConversation as agentUpdateConversation,
  deleteConversation as agentDeleteConversation,
  listConversationShares,
  type AgentConversation,
  type AgentMessage,
  type AgentConversationShare,
} from './chat-api-client';
import { generateConversationTitle } from './llm-client';

// ---------------------------------------------------------------------------
// Local types (caller-facing, camelCase)
// ---------------------------------------------------------------------------

export interface Conversation {
  id: string;
  ownerId: string;
  title: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  content: string;
  role: string;
  createdAt: Date;
  attachments?: Array<{
    name: string;
    type: string;
    url: string;
    size: number;
    knowledge_base_id?: string;
  }>;
}

export interface ConversationShare {
  id: string;
  userId: string;
  role: string;
  sharedBy: string;
  sharedAt: Date;
}

export interface ConversationWithPreview extends Conversation {
  messageCount: number;
  lastMessage?: {
    content: string;
    createdAt: Date;
  };
  shares?: ConversationShare[];
  isShared?: boolean;
  shareRole?: 'viewer' | 'editor';
  sharedBy?: string;
}

export interface ConversationListOptions {
  userId: string;
  page?: number;
  limit?: number;
  includeShared?: boolean;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapAgentConversationToConversation(ac: AgentConversation): Conversation {
  return {
    id: ac.id,
    ownerId: ac.user_id,
    title: ac.title,
    isPrivate: ac.is_private,
    createdAt: new Date(ac.created_at),
    updatedAt: new Date(ac.updated_at),
  };
}

function mapAgentMessageToMessage(am: AgentMessage): Message {
  return {
    id: am.id,
    content: am.content,
    role: am.role,
    createdAt: new Date(am.created_at),
    attachments: am.attachments,
  };
}

function mapAgentShareToShare(as: AgentConversationShare): ConversationShare {
  return {
    id: as.id,
    userId: as.user_id,
    role: as.role,
    sharedBy: as.shared_by,
    sharedAt: new Date(as.shared_at),
  };
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Get user's conversations with pagination (simple signature)
 *
 * @param token - Agent-api access token
 * @param userId - User ID
 * @param page - Page number (default: 1)
 * @param pageSize - Items per page (default: 20)
 * @returns Paginated list of conversations
 */
export async function getConversations(
  token: string,
  userId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{
  conversations: ConversationWithPreview[];
  total: number;
  page: number;
  limit: number;
}> {
  return getUserConversations(token, {
    userId,
    page,
    limit: pageSize,
    includeShared: true,
  });
}

/**
 * Get user's conversations with pagination
 *
 * @param token - Agent-api access token
 * @param options - Query options
 * @returns Paginated list of conversations
 */
export async function getUserConversations(
  token: string,
  options: ConversationListOptions
): Promise<{
  conversations: ConversationWithPreview[];
  total: number;
  page: number;
  limit: number;
}> {
  const { userId, page = 1, limit = 20, includeShared = true } = options;
  const offset = (page - 1) * limit;

  const { conversations: agentConvs, total } = await listConversations(token, {
    limit,
    offset,
    order_by: 'updated_at',
    order: 'desc',
    source: 'busibox-portal',
  });

  // If includeShared is false, filter to owned only
  const filtered = includeShared
    ? agentConvs
    : agentConvs.filter((c) => c.user_id === userId);

  const conversationsWithPreview: ConversationWithPreview[] = [];
  for (const conv of filtered) {
    const base = mapAgentConversationToConversation(conv);
    const isOwned = conv.user_id === userId;

    let shares: ConversationShare[] = [];
    let shareRole: 'viewer' | 'editor' | undefined;
    let sharedBy: string | undefined;

    if (!isOwned) {
      try {
        const { shares: agentShares } = await listConversationShares(token, conv.id);
        const userShare = agentShares.find((s) => s.user_id === userId);
        if (userShare) {
          shares = [mapAgentShareToShare(userShare)];
          shareRole = userShare.role === 'editor' ? 'editor' : 'viewer';
          sharedBy = userShare.shared_by;
        }
      } catch {
        // Ignore share fetch errors
      }
    }

    conversationsWithPreview.push({
      ...base,
      messageCount: conv.message_count ?? 0,
      lastMessage: conv.last_message
        ? {
            content: conv.last_message.content,
            createdAt: new Date(conv.last_message.created_at),
          }
        : undefined,
      shares,
      isShared: !isOwned && !!shares.length,
      shareRole,
      sharedBy,
    });
  }

  return {
    conversations: conversationsWithPreview,
    total: includeShared ? total : filtered.length,
    page,
    limit,
  };
}

/**
 * Create a new conversation
 *
 * @param token - Agent-api access token
 * @param userId - Owner user ID
 * @param title - Conversation title (optional, defaults to "New Conversation")
 * @param isPrivate - Privacy flag (default: false)
 * @returns Created conversation
 */
export async function createConversation(
  token: string,
  userId: string,
  title?: string,
  isPrivate: boolean = false
): Promise<Conversation> {
  const ac = await agentCreateConversation(token, {
    title: title || 'New Conversation',
    source: 'busibox-portal',
    is_private: isPrivate,
  });
  return mapAgentConversationToConversation(ac);
}

/**
 * Get a single conversation by ID
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param userId - User ID (for access check)
 * @param includeMessages - Include messages (default: false)
 * @returns Conversation or null if not found/no access
 */
export async function getConversation(
  token: string,
  conversationId: string,
  userId: string,
  includeMessages: boolean = false
): Promise<(Conversation & { messages?: Message[] }) | null> {
  try {
    const ac = await agentGetConversation(token, conversationId, {
      include_messages: includeMessages,
    });

    const base = mapAgentConversationToConversation(ac);
    const messages = ac.messages?.map(mapAgentMessageToMessage);

    return {
      ...base,
      ...(messages ? { messages } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Update conversation (title, privacy)
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param userId - User ID (must be owner)
 * @param updates - Fields to update
 * @returns Updated conversation or null if not owner
 */
export async function updateConversation(
  token: string,
  conversationId: string,
  userId: string,
  updates: {
    title?: string;
    isPrivate?: boolean;
  }
): Promise<Conversation | null> {
  try {
    const ac = await agentUpdateConversation(token, conversationId, {
      title: updates.title,
      is_private: updates.isPrivate,
    });
    return mapAgentConversationToConversation(ac);
  } catch {
    return null;
  }
}

/**
 * Delete a conversation
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param userId - User ID (must be owner)
 * @returns True if deleted, false if not owner or not found
 */
export async function deleteConversation(
  token: string,
  conversationId: string,
  userId: string
): Promise<boolean> {
  try {
    await agentDeleteConversation(token, conversationId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Auto-generate and update conversation title from first message
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param firstMessage - First user message content
 * @param userId - User ID (must be owner)
 */
export async function autoGenerateTitle(
  token: string,
  conversationId: string,
  firstMessage: string,
  userId: string
): Promise<void> {
  try {
    const conv = await agentGetConversation(token, conversationId);
    if (conv.user_id !== userId) return;
    if (conv.title !== 'New Conversation') return;

    const title = await generateConversationTitle(firstMessage);
    await agentUpdateConversation(token, conversationId, { title });
  } catch {
    // Silently ignore
  }
}

/**
 * Check if user has access to conversation
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param userId - User ID
 * @returns Access level: 'owner', 'editor', 'viewer', or null
 */
export async function checkConversationAccess(
  token: string,
  conversationId: string,
  userId: string
): Promise<'owner' | 'editor' | 'viewer' | null> {
  try {
    const conv = await agentGetConversation(token, conversationId);
    if (conv.user_id === userId) return 'owner';

    const { shares } = await listConversationShares(token, conversationId);
    const share = shares.find((s) => s.user_id === userId);
    if (share) return share.role === 'editor' ? 'editor' : 'viewer';
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if user can edit a conversation (owner or editor)
 */
export async function canEditConversation(
  token: string,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const role = await checkConversationAccess(token, conversationId, userId);
  return role === 'owner' || role === 'editor';
}

/**
 * Get conversation statistics
 *
 * @param token - Agent-api access token
 * @param userId - User ID
 * @returns Conversation statistics
 */
export async function getConversationStats(token: string, userId: string): Promise<{
  total: number;
  ownedCount: number;
  sharedCount: number;
}> {
  const { conversations, total } = await listConversations(token, {
    limit: 10000,
    offset: 0,
    source: 'busibox-portal',
  });

  const ownedCount = conversations.filter((c) => c.user_id === userId).length;
  const sharedCount = conversations.filter((c) => c.user_id !== userId).length;

  return {
    total,
    ownedCount,
    sharedCount,
  };
}
