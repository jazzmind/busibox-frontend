/**
 * Chat Insights Service
 *
 * Extracts insights from conversations and stores them in Milvus via search-api.
 *
 * Architecture: Insights stored in Milvus (via search-api) for vector similarity search.
 * Uses busibox-app insights client which wraps search-api HTTP endpoints.
 * Uses agent-api HTTP client for conversation/message data (no Prisma).
 */

import {
  listConversations,
  getConversation,
  listConversationShares,
} from './chat-api-client';
import {
  insertInsights,
  searchInsights,
  deleteConversationInsights,
  flushInsightsCollection,
  type ChatInsight,
  type InsightSearchResult,
} from './insights';
import { generateEmbeddingForUser as generateEmbedding } from '@jazzmind/busibox-app';
import { extractInsightsFromText } from './llm-client';

/**
 * Get conversations that need insight extraction
 *
 * Finds conversations that:
 * - Are not private
 * - Have messages
 *
 * @param token - Agent-api access token
 * @param userId - User ID (optional, if provided only returns for that user)
 * @returns Array of conversation IDs that need analysis
 */
export async function getUnanalyzedConversations(
  token: string,
  userId?: string
): Promise<Array<{ id: string; userId: string; lastMessageAt: Date }>> {
  const { conversations } = await listConversations(token, {
    limit: 1000,
    offset: 0,
    source: 'busibox-portal',
  });

  const filtered = conversations.filter(
    (conv) =>
      !conv.is_private &&
      conv.last_message != null &&
      (userId == null || conv.user_id === userId)
  );

  return filtered.map((conv) => ({
    id: conv.id,
    userId: conv.user_id,
    lastMessageAt: new Date(conv.last_message!.created_at ?? conv.updated_at),
  }));
}

/**
 * Extract insights from a conversation
 *
 * Uses AI to extract meaningful insights from conversation messages,
 * generates embeddings, and stores them in Milvus.
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param userId - User ID (owner of conversation)
 * @returns Number of insights extracted
 */
export async function extractConversationInsights(
  token: string,
  conversationId: string,
  userId: string
): Promise<number> {
  const conversation = await getConversation(token, conversationId, {
    include_messages: true,
  });

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  if (conversation.is_private) {
    return 0;
  }

  const messages = conversation.messages ?? [];
  if (messages.length === 0) {
    return 0;
  }

  const conversationText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n\n');

  const insightTexts = await extractInsightsFromText(conversationText);

  if (insightTexts.length === 0) {
    return 0;
  }

  const insights: ChatInsight[] = [];
  const analyzedAt = Math.floor(Date.now() / 1000);

  for (const insightText of insightTexts) {
    const truncatedInsight = insightText.substring(0, 500);

    try {
      const embedding = await generateEmbedding(truncatedInsight, userId);

      insights.push({
        id: `${conversationId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userId,
        content: truncatedInsight,
        embedding,
        conversationId,
        analyzedAt,
      });
    } catch (error) {
      console.error(`Failed to generate embedding for insight:`, error);
    }
  }

  if (insights.length > 0) {
    await insertInsights(insights);
    await flushInsightsCollection();
  }

  const { shares } = await listConversationShares(token, conversationId);
  if (shares.length > 0) {
    for (const share of shares) {
      const sharedInsights: ChatInsight[] = [];

      for (const insightText of insightTexts) {
        const truncatedInsight = insightText.substring(0, 500);

        try {
          const embedding = await generateEmbedding(truncatedInsight, share.user_id);

          sharedInsights.push({
            id: `${conversationId}-${share.user_id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            userId: share.user_id,
            content: truncatedInsight,
            embedding,
            conversationId,
            analyzedAt,
          });
        } catch (error) {
          console.error(`Failed to generate embedding for shared insight:`, error);
        }
      }

      if (sharedInsights.length > 0) {
        await insertInsights(sharedInsights);
      }
    }

    await flushInsightsCollection();
  }

  return insights.length;
}

/**
 * Extract insights from all unanalyzed conversations
 *
 * @param token - Agent-api access token
 * @param userId - Optional user ID to limit extraction to specific user
 * @returns Summary of extraction results
 */
export async function extractInsights(
  token: string,
  userId?: string
): Promise<{
  processed: number;
  insightsExtracted: number;
  errors: Array<{ conversationId: string; error: string }>;
}> {
  const unanalyzed = await getUnanalyzedConversations(token, userId);

  let processed = 0;
  let insightsExtracted = 0;
  const errors: Array<{ conversationId: string; error: string }> = [];

  for (const conv of unanalyzed) {
    try {
      const count = await extractConversationInsights(token, conv.id, conv.userId);
      insightsExtracted += count;
      processed++;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push({
        conversationId: conv.id,
        error: msg,
      });
      console.error(`Failed to extract insights from conversation ${conv.id}:`, error);
    }
  }

  return {
    processed,
    insightsExtracted,
    errors,
  };
}

/**
 * Query insights for a user based on a search query
 *
 * Uses search-api via busibox-app insights client.
 *
 * @param token - Agent-api access token (reserved for future use)
 * @param query - Search query text
 * @param userId - User ID
 * @param options - Search options
 * @returns Array of relevant insights
 */
export async function queryInsights(
  token: string,
  query: string,
  userId: string,
  options: {
    limit?: number;
    scoreThreshold?: number;
  } = {}
): Promise<InsightSearchResult[]> {
  return searchInsights(query, userId, options);
}

/**
 * Delete insights for a conversation (when conversation becomes private or is deleted)
 *
 * @param token - Agent-api access token (reserved for future use)
 * @param conversationId - Conversation ID
 * @param userId - User ID (for authorization)
 */
export async function deleteInsightsForConversation(
  token: string,
  conversationId: string,
  userId: string
): Promise<void> {
  await deleteConversationInsights(conversationId, userId);
}

/**
 * Delete insights for all users when conversation privacy changes
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 */
export async function deleteAllInsightsForConversation(
  token: string,
  conversationId: string
): Promise<void> {
  const conversation = await getConversation(token, conversationId);

  if (conversation) {
    await deleteConversationInsights(conversationId, conversation.user_id);
  }
}
