/**
 * Message Service
 *
 * Business logic for message management.
 * Handles saving messages, building context, and managing conversation flow.
 * Uses agent-api HTTP client instead of Prisma.
 */

import {
  listMessages,
  createMessage,
  getMessage,
  deleteMessage as agentApiDeleteMessage,
  type AgentMessage,
  type AgentChatAttachment,
} from './chat-api-client';
import { searchInsights, type InsightSearchResult } from './insights';

export interface MessageWithAttachments {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
  attachments: Array<{
    id: string;
    filename: string;
    parsedContent?: string;
    fileUrl?: string;
    mimeType?: string;
    addedToLibrary?: boolean;
    libraryDocumentId?: string;
  }>;
}

export interface MessageContext {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  insights?: string[];
  insightIds?: string[];
  attachments?: Array<{
    filename: string;
    content?: string;
    url?: string;
  }>;
  webSearchResults?: Array<{
    title: string;
    url: string;
    snippet: string;
    score?: number;
  }>;
  docSearchResults?: Array<{
    id: string;
    title: string;
    snippet: string;
    source: string;
    url?: string;
    score: number;
  }>;
}

/**
 * Map AgentMessage to MessageWithAttachments
 */
function mapAgentMessageToMessageWithAttachments(msg: AgentMessage): MessageWithAttachments {
  const attachments = (msg.chat_attachments ?? []).map((a: AgentChatAttachment) => ({
    id: a.id,
    filename: a.filename,
    parsedContent: a.parsed_content,
    fileUrl: a.file_url,
    mimeType: a.mime_type,
    addedToLibrary: a.added_to_library,
    libraryDocumentId: a.library_document_id,
  }));
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.created_at,
    attachments,
  };
}

/**
 * Get messages for a conversation
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param options - Query options (note: `before` is not supported by agent-api)
 * @returns Messages with attachments
 */
export async function getMessages(
  token: string,
  conversationId: string,
  options: {
    limit?: number;
    offset?: number;
    before?: Date;
    includeAttachments?: boolean;
  } = {}
): Promise<MessageWithAttachments[]> {
  const { limit, offset = 0 } = options;

  const { messages } = await listMessages(token, conversationId, {
    limit: limit ?? 500,
    offset,
    order: 'asc',
  });

  return messages.map(mapAgentMessageToMessageWithAttachments);
}

/**
 * Save a user message
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param content - Message content
 * @param attachmentIds - Optional attachment IDs
 * @returns Created message
 */
export async function saveUserMessage(
  token: string,
  conversationId: string,
  content: string,
  attachmentIds?: string[]
): Promise<MessageWithAttachments> {
  const msg = await createMessage(token, conversationId, {
    role: 'user',
    content,
    attachment_ids: attachmentIds && attachmentIds.length > 0 ? attachmentIds : undefined,
  });
  return mapAgentMessageToMessageWithAttachments(msg);
}

/**
 * Save an assistant message
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param content - Message content
 * @param metadata - Optional metadata (search results, insights used, etc.)
 * @returns Created message
 */
export async function saveAssistantMessage(
  token: string,
  conversationId: string,
  content: string,
  metadata?: {
    webSearchResults?: unknown;
    docSearchResults?: unknown;
    usedInsightIds?: string[];
  }
): Promise<MessageWithAttachments> {
  const msg = await createMessage(token, conversationId, {
    role: 'assistant',
    content,
    metadata: {
      web_search_results: metadata?.webSearchResults,
      doc_search_results: metadata?.docSearchResults,
      used_insight_ids: metadata?.usedInsightIds ?? [],
    },
  });
  return mapAgentMessageToMessageWithAttachments(msg);
}

/**
 * Build message context for AI
 *
 * Includes:
 * - Conversation history (recent messages)
 * - Relevant insights from past conversations (RAG)
 * - Attachment content (if applicable)
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @param userId - User ID (for insight search)
 * @param currentMessage - Current user message
 * @param options - Context options
 * @returns Message context for AI
 */
export async function buildMessageContext(
  token: string,
  conversationId: string,
  userId: string,
  currentMessage: string,
  options: {
    maxHistoryMessages?: number;
    includeInsights?: boolean;
    maxInsights?: number;
    enableWebSearch?: boolean;
    enableDocumentSearch?: boolean;
    excludeCurrentMessage?: boolean;
  } = {}
): Promise<MessageContext> {
  const {
    maxHistoryMessages = 10,
    includeInsights = true,
    maxInsights = 3,
    excludeCurrentMessage = false,
  } = options;

  // 1. Get recent conversation history
  const limit = excludeCurrentMessage ? maxHistoryMessages + 1 : maxHistoryMessages;
  let history = await getMessages(token, conversationId, { limit });

  if (excludeCurrentMessage && history.length > 0) {
    history = history.slice(0, -1);
  }

  // 2. Search for relevant insights (if enabled)
  let insights: string[] | undefined;
  let insightIds: string[] | undefined;
  if (includeInsights) {
    try {
      const insightResults: InsightSearchResult[] = await searchInsights(currentMessage, userId, {
        limit: maxInsights,
        scoreThreshold: 0.7,
      });
      insights = insightResults.map((r) => r.content);
      insightIds = insightResults.map((r) => r.id);
    } catch (error) {
      console.warn('Failed to search insights:', error);
    }
  }

  // 3. Perform document search (if enabled)
  let docSearchResults: Array<{
    id: string;
    title: string;
    snippet: string;
    source: string;
    url?: string;
    score: number;
  }> | undefined;

  const { enableDocumentSearch } = options;

  if (enableDocumentSearch) {
    try {
      const { searchDocuments } = await import('./chat-search');
      const docResult = await searchDocuments(currentMessage, userId, {
        limit: 5,
        mode: 'hybrid',
      });
      if (!docResult.error && docResult.results.length > 0) {
        docSearchResults = docResult.results;
      }
    } catch (error) {
      console.warn('Failed to perform document search:', error);
    }
  }

  // 4. Build message array for AI
  const messages = history.map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
  }));

  // 5. Extract attachment content from recent messages
  const attachments: Array<{
    filename: string;
    content?: string;
    url?: string;
  }> = [];

  for (const msg of history) {
    if (msg.attachments && msg.attachments.length > 0) {
      for (const attachment of msg.attachments) {
        attachments.push({
          filename: attachment.filename,
          content: attachment.parsedContent,
          url: attachment.fileUrl,
        });
      }
    }
  }

  return {
    messages,
    insights,
    insightIds,
    attachments: attachments.length > 0 ? attachments : undefined,
    webSearchResults: undefined, // Web search is available as LLM tool, not pre-fetched
    docSearchResults,
  };
}

/**
 * Delete a message
 *
 * @param token - Agent-api access token
 * @param messageId - Message ID
 * @param userId - User ID (must be conversation owner; agent-api enforces via token)
 * @returns True if deleted, false if not found or not authorized
 */
export async function deleteMessage(
  token: string,
  messageId: string,
  userId: string
): Promise<boolean> {
  try {
    const message = await getMessage(token, messageId);
    const conversationId = message.conversation_id;

    await agentApiDeleteMessage(token, conversationId, messageId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get message count for conversation
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @returns Message count
 */
export async function getMessageCount(token: string, conversationId: string): Promise<number> {
  const { total } = await listMessages(token, conversationId, { limit: 1 });
  return total;
}

/**
 * Get latest message from conversation
 *
 * @param token - Agent-api access token
 * @param conversationId - Conversation ID
 * @returns Latest message or null
 */
export async function getLatestMessage(
  token: string,
  conversationId: string
): Promise<MessageWithAttachments | null> {
  const { messages } = await listMessages(token, conversationId, {
    limit: 1,
    order: 'desc',
  });
  if (messages.length === 0) return null;
  return mapAgentMessageToMessageWithAttachments(messages[0]);
}

/**
 * Format message context for AI prompt
 *
 * Creates a structured prompt that includes:
 * - System instructions
 * - Insights from past conversations
 * - Attachment content
 * - Conversation history
 *
 * @param context - Message context
 * @param systemPrompt - Optional system prompt override
 * @returns Formatted messages for OpenAI
 */
export function formatContextForAI(
  context: MessageContext,
  systemPrompt?: string
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const formattedMessages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }> = [];

  // 1. System prompt with context
  let systemContent = systemPrompt || 'You are a helpful AI assistant.';

  // Add markdown and LaTeX formatting instructions
  systemContent += '\n\nFormatting Guidelines:\n- Use proper markdown formatting for structure (headings, lists, bold, etc.)\n- For mathematical equations, use LaTeX syntax with proper delimiters:\n  - Inline math: $equation$ (e.g., $E = mc^2$)\n  - Display math: $$equation$$ (e.g., $$\\int_0^\\infty e^{-x^2} dx$$)\n- Use \\vec{} for vectors, \\frac{}{} for fractions, \\times for multiplication, etc.';

  // Add insights context if available
  if (context.insights && context.insights.length > 0) {
    systemContent += '\n\nRelevant context from past conversations:';
    context.insights.forEach((insight, i) => {
      systemContent += `\n${i + 1}. ${insight}`;
    });
  }

  // Add attachment context if available
  if (context.attachments && context.attachments.length > 0) {
    systemContent += '\n\nAttached files:';
    context.attachments.forEach((att) => {
      systemContent += `\n- ${att.filename}`;
      if (att.content) {
        systemContent += `\n  Content: ${att.content.substring(0, 500)}...`;
      }
    });
  }

  // Add web search results if available
  if (context.webSearchResults && context.webSearchResults.length > 0) {
    systemContent += '\n\nWeb Search Results:';
    context.webSearchResults.forEach((result, i) => {
      systemContent += `\n${i + 1}. [${result.title}](${result.url})`;
      systemContent += `\n   ${result.snippet.substring(0, 200)}...`;
    });
    systemContent += '\n\nPlease cite sources when using information from web search results.';
  }

  // Add document search results if available
  if (context.docSearchResults && context.docSearchResults.length > 0) {
    systemContent += '\n\nDocument Library Search Results:';
    context.docSearchResults.forEach((result, i) => {
      systemContent += `\n${i + 1}. ${result.title} (${result.source})`;
      systemContent += `\n   ${result.snippet.substring(0, 200)}...`;
      if (result.url) {
        systemContent += `\n   Source: ${result.url}`;
      }
    });
    systemContent += '\n\nPlease cite document sources when referencing information from the document library.';
  }

  formattedMessages.push({
    role: 'system',
    content: systemContent,
  });

  // 2. Conversation history
  formattedMessages.push(...context.messages);

  return formattedMessages;
}
