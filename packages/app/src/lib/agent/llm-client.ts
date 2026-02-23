/**
 * LiteLLM Client Wrapper
 *
 * Centralized liteLLM API client with error handling and logging.
 * All LLM operations go through liteLLM proxy.
 */

import OpenAI from 'openai';

// Lazy initialization of liteLLM client
function getLiteLLMClient() {
  return new OpenAI({
    apiKey: process.env.LITELLM_API_KEY || 'sk-litellm-master-key-change-me',
    baseURL: process.env.LITELLM_BASE_URL || 'http://localhost:4000/v1',
  });
}

/**
 * Check if liteLLM is properly configured
 */
export function isOpenAIConfigured(): boolean {
  // For backward compatibility, check if liteLLM is configured
  return !!process.env.LITELLM_BASE_URL;
}

// Legacy export for backward compatibility (deprecated - use getLiteLLMClient instead)
export const openai = {
  chat: {
    completions: {
      create: async (...args: Parameters<OpenAI['chat']['completions']['create']>) => {
        const client = getLiteLLMClient();
        return client.chat.completions.create(...args);
      },
    },
  },
  embeddings: {
    create: async (...args: Parameters<OpenAI['embeddings']['create']>) => {
      const client = getLiteLLMClient();
      return client.embeddings.create(...args);
    },
  },
  moderations: {
    create: async (...args: Parameters<OpenAI['moderations']['create']>) => {
      const client = getLiteLLMClient();
      return client.moderations.create(...args);
    },
  },
} as OpenAI;

/**
 * Generate a chat completion with streaming support
 *
 * @param messages - Array of chat messages
 * @param options - Generation options
 * @returns Stream or complete response based on stream flag
 */
export async function generateChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    tools?: OpenAI.Chat.ChatCompletionTool[];
  } = {}
) {
  if (!isOpenAIConfigured()) {
    throw new Error('LiteLLM not configured');
  }

  const {
    model,
    temperature = 0.7,
    maxTokens = 2000,
    stream = false,
    tools,
  } = options;

  const litellm = getLiteLLMClient();

  // Get default model if not specified
  let modelName = model;
  if (!modelName) {
    const { getModelName } = await import('./models');
    modelName = await getModelName();
  }

  return litellm.chat.completions.create({
    model: modelName,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream,
    tools,
  });
}

/**
 * Generate a concise title for a conversation based on the first message
 *
 * @param firstUserMessage - The first message in the conversation
 * @returns A short, descriptive title (max 50 chars)
 */
export async function generateConversationTitle(
  firstUserMessage: string
): Promise<string> {
  // Use liteLLM if available, otherwise fallback
  const useLiteLLM = !!process.env.LITELLM_BASE_URL;

  if (useLiteLLM) {
    try {
      const litellm = new OpenAI({
        apiKey: process.env.LITELLM_API_KEY || 'sk-litellm-master-key-change-me',
        baseURL: process.env.LITELLM_BASE_URL || 'http://localhost:4000/v1',
      });

      // Use "fast" model for title generation (as specified)
      const modelName = 'fast';

      const response = await litellm.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: 'Generate a concise, descriptive title (max 50 characters) for a conversation that starts with the following user message. Return only the title, no quotes or extra text.',
          },
          {
            role: 'user',
            content: firstUserMessage.substring(0, 500), // Limit input length
          },
        ],
        temperature: 0.5,
        max_tokens: 20,
      });

      const title = response.choices[0]?.message?.content?.trim() || firstUserMessage.substring(0, 50);
      return title.substring(0, 50).trim();
    } catch (error) {
      console.error('Failed to generate title with liteLLM:', error);
      // Fallback to simple truncation
      return firstUserMessage.substring(0, 50).trim() + (firstUserMessage.length > 50 ? '...' : '');
    }
  }

  // Fallback: Use first 50 chars of message
  return firstUserMessage.substring(0, 50).trim() + (firstUserMessage.length > 50 ? '...' : '');
}

/**
 * NOTE: Embedding generation has been moved to @/lib/embeddings/data-client
 * which uses the local FastEmbed service (bge-large-en-v1.5, 1024 dimensions)
 * instead of OpenAI/liteLLM embeddings.
 */

/**
 * Extract insights from text (conversation or document)
 *
 * This function analyzes text and extracts key insights,
 * learnings, or knowledge that can be stored for future retrieval.
 *
 * @param text - Text to analyze
 * @returns Array of insight strings
 */
export async function extractInsightsFromText(text: string): Promise<string[]> {
  if (!isOpenAIConfigured()) {
    return [];
  }

  if (!text || text.trim().length === 0) {
    return [];
  }

  try {
    const litellm = getLiteLLMClient();
    const { getModelName } = await import('./models');
    const modelName = await getModelName('analysis'); // Use analysis model for insight extraction

    const response = await litellm.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting key insights from conversations.
          Analyze the conversation and extract 3-5 important insights, learnings, or pieces of knowledge.
          Each insight should be:
          - A complete, standalone statement (max 500 characters)
          - Useful for future conversations
          - Specific and actionable
          - Focused on user preferences, context, or important information

          Return insights as a JSON object with an "insights" array of strings. Example:
          {"insights": ["The user prefers Python for data analysis", "User is working on a machine learning project for image classification"]}`,
        },
        {
          role: 'user',
          content: `Extract insights from this conversation:\n\n${text}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content);
    return Array.isArray(parsed.insights) ? parsed.insights : [];
  } catch (error) {
    console.error('Failed to extract insights:', error);
    return [];
  }
}

/**
 * Extract insights from conversation messages
 *
 * This function analyzes a conversation and extracts key insights,
 * learnings, or knowledge that can be stored for future retrieval.
 *
 * @param messages - Array of conversation messages
 * @returns Array of insight strings
 */
export async function extractInsightStringsFromMessages(
  messages: Array<{ role: string; content: string }>
): Promise<string[]> {
  if (!isOpenAIConfigured()) {
    return [];
  }

  if (messages.length < 2) {
    return []; // Need at least a question and answer
  }

  try {
    const conversationText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    const litellm = getLiteLLMClient();
    const { getModelName } = await import('./models');
    const modelName = await getModelName('analysis'); // Use analysis model for insight extraction

    const response = await litellm.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting key insights from conversations.
          Analyze the conversation and extract 3-5 important insights, learnings, or pieces of knowledge.
          Each insight should be:
          - A complete, standalone statement
          - Useful for future conversations
          - Specific and actionable

          Return insights as a JSON array of strings. Example:
          ["The user prefers Python for data analysis", "User is working on a machine learning project for image classification"]`,
        },
        {
          role: 'user',
          content: `Extract insights from this conversation:\n\n${conversationText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content);
    return Array.isArray(parsed.insights) ? parsed.insights : [];
  } catch (error) {
    console.error('Failed to extract insights:', error);
    return [];
  }
}

/**
 * Moderate content for safety using OpenAI's moderation API
 *
 * @param text - Text to moderate
 * @returns Moderation result
 */
export async function moderateContent(text: string) {
  if (!isOpenAIConfigured()) {
    return { flagged: false, categories: {} };
  }

  try {
    const litellm = getLiteLLMClient();
    const response = await litellm.moderations.create({
      input: text,
    });

    return response.results[0];
  } catch (error) {
    console.error('Content moderation failed:', error);
    return { flagged: false, categories: {} };
  }
}

/**
 * Count tokens in text (approximate)
 *
 * Note: This is a rough estimate. For exact counts, use tiktoken library.
 *
 * @param text - Text to count tokens for
 * @returns Approximate token count
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token
  // This is approximate and varies by content
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token limit
 *
 * @param text - Text to truncate
 * @param maxTokens - Maximum number of tokens
 * @returns Truncated text
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokenCount(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Approximate character limit (4 chars per token)
  const maxChars = maxTokens * 4;
  return text.substring(0, maxChars) + '...';
}

export default openai;
