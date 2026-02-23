/**
 * Conversation Sharing Service
 *
 * Handles sharing conversations with other users, including:
 * - Creating and managing shares
 * - Verifying permissions
 * - Triggering insight extraction for shared users
 *
 * Uses agent-api HTTP client (no Prisma).
 */

import {
  getConversation,
  shareConversation as agentShareConversation,
  unshareConversation as agentUnshareConversation,
  listConversationShares,
} from './chat-api-client';
import { checkConversationAccess } from './chat-conversations';
import { extractConversationInsights } from './chat-insights';
import { getUserByEmail, getUser } from '../authz/user-management';

export type ShareRole = 'viewer' | 'editor';

export interface ShareConversationInput {
  conversationId: string;
  ownerId: string;
  targetUserEmail: string;
  role: ShareRole;
}

export interface ConversationShareInfo {
  id: string;
  userId: string;
  userEmail: string;
  role: ShareRole;
  sharedBy: string;
  sharedAt: Date;
}

/**
 * Share a conversation with another user
 *
 * @param token - Agent-api access token
 * @param input - Share input parameters
 * @returns Created share record
 * @throws Error if conversation not found, user is owner, conversation is private, or target user not found
 */
export async function shareConversation(
  token: string,
  input: ShareConversationInput
): Promise<ConversationShareInfo> {
  const { conversationId, ownerId, targetUserEmail, role } = input;

  // 1. Verify conversation exists and user is owner
  const conversation = await getConversation(token, conversationId);

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.user_id !== ownerId) {
    throw new Error('Only the conversation owner can share it');
  }

  if (conversation.is_private) {
    throw new Error('Cannot share private conversations');
  }

  // 2. Find target user by email (from authz)
  const targetUser = await getUserByEmail(targetUserEmail.toLowerCase());

  if (!targetUser) {
    throw new Error('User not found');
  }

  // 3. Prevent sharing with self
  if (targetUser.id === ownerId) {
    throw new Error('Cannot share conversation with yourself');
  }

  // 4. Create or update share (agent-api handles existing share)
  const share = await agentShareConversation(token, conversationId, targetUser.id, role);

  // 5. Trigger insight extraction for target user (async, don't wait)
  extractConversationInsights(token, conversationId, targetUser.id).catch((err) =>
    console.error(`Failed to extract insights for shared user ${targetUser.id}:`, err)
  );

  return {
    id: share.id,
    userId: share.user_id,
    userEmail: targetUser.email,
    role: share.role as ShareRole,
    sharedBy: share.shared_by,
    sharedAt: new Date(share.shared_at),
  };
}

/**
 * Unshare a conversation with a specific user
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param userId - User ID to unshare with
 * @param ownerId - Owner ID (for verification)
 * @returns True if unshared successfully
 * @throws Error if conversation not found, user is not owner, or share not found
 */
export async function unshareConversation(
  token: string,
  conversationId: string,
  userId: string,
  ownerId: string
): Promise<boolean> {
  // 1. Verify conversation exists and user is owner
  const conversation = await getConversation(token, conversationId);

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.user_id !== ownerId) {
    throw new Error('Only the conversation owner can unshare it');
  }

  // 2. Delete share (agent-api returns 404 if share not found)
  try {
    await agentUnshareConversation(token, conversationId, userId);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('404') || msg.includes('Share not found')) {
      throw new Error('Share not found');
    }
    throw error;
  }

  return true;
}

/**
 * Get all shares for a conversation
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param userId - User ID (must be owner or shared user)
 * @returns Array of share information
 */
export async function getConversationShares(
  token: string,
  conversationId: string,
  userId: string
): Promise<ConversationShareInfo[]> {
  // Verify user has access (getConversation throws if no access)
  await getConversation(token, conversationId);

  const { shares } = await listConversationShares(token, conversationId);

  const sharesWithEmails = await Promise.all(
    shares.map(async (share) => {
      const user = await getUser(share.user_id);
      return {
        id: share.id,
        userId: share.user_id,
        userEmail: user?.email || 'unknown',
        role: share.role as ShareRole,
        sharedBy: share.shared_by,
        sharedAt: new Date(share.shared_at),
      };
    })
  );

  return sharesWithEmails;
}

/**
 * Get rich access info for a conversation
 *
 * Wraps the canonical checkConversationAccess from chat-conversations.
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param userId - User ID to check
 * @returns Object with hasAccess, role, and isOwner flags
 */
export async function getConversationAccessInfo(
  token: string,
  conversationId: string,
  userId: string
): Promise<{
  hasAccess: boolean;
  role: 'owner' | 'editor' | 'viewer' | null;
  isOwner: boolean;
}> {
  const role = await checkConversationAccess(token, conversationId, userId);
  return {
    hasAccess: role !== null,
    role,
    isOwner: role === 'owner',
  };
}
