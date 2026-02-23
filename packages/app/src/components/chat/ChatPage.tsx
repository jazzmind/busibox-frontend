/**
 * Chat Page - Server Component
 * 
 * Server-rendered chat page that fetches initial data server-side
 * and passes it to client components for interactivity.
 * 
 * Uses React Suspense streaming to show the chat skeleton immediately
 * while data loads in the background, providing instant page feedback.
 * 
 * Usage in consuming app:
 * ```typescript
 * // app/chat/page.tsx
 * import { ChatPage } from '@jazzmind/busibox-app/components';
 * import { createAgentClient } from '@jazzmind/busibox-app/lib/agent';
 * 
 * export default async function Page() {
 *   const client = createAgentClient({
 *     agentUrl: process.env.AGENT_API_URL!,
 *     getAuthToken: async () => getServerAuthToken(),
 *   });
 * 
 *   return <ChatPage client={client} />;
 * }
 * ```
 */

import { Suspense } from 'react';
import { AgentClient } from '../../lib/agent/agent-service-client';
import { ChatContainer } from './ChatContainer';
import { ChatSkeleton } from './ChatSkeleton';

export interface ChatPageProps {
  /** Server-side agent client */
  client: AgentClient;
  /** Show insights panel (default: true) */
  showInsights?: boolean;
  /** Allow conversation management (default: true) */
  allowConversationManagement?: boolean;
  /** Initial conversation ID to load */
  initialConversationId?: string;
  /** Source identifier for filtering/creating conversations (e.g., 'busibox-portal', 'busibox-agents') */
  source?: string;
  /** URL query parameter name for persisting the active conversation (default: 'conversation') */
  conversationQueryParam?: string;
  /** Custom CSS class */
  className?: string;
}

export async function ChatPage({
  client,
  showInsights = true,
  allowConversationManagement = true,
  initialConversationId,
  source,
  conversationQueryParam,
  className,
}: ChatPageProps) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatPageContent
        client={client}
        showInsights={showInsights}
        allowConversationManagement={allowConversationManagement}
        initialConversationId={initialConversationId}
        source={source}
        conversationQueryParam={conversationQueryParam}
        className={className}
      />
    </Suspense>
  );
}

/**
 * Internal async component that does the actual data fetching.
 * Wrapped in Suspense by ChatPage so the skeleton shows immediately.
 */
async function ChatPageContent({
  client,
  showInsights,
  allowConversationManagement,
  initialConversationId,
  source,
  conversationQueryParam,
  className,
}: {
  client: AgentClient;
  showInsights: boolean;
  allowConversationManagement: boolean;
  initialConversationId?: string;
  source?: string;
  conversationQueryParam?: string;
  className?: string;
}) {
  // Fetch initial data server-side (filter by source if provided)
  // Use individual try/catch to gracefully degrade if agent API is unreachable
  let conversations: any[] = [];
  let agents: any[] = [];
  let tools: any[] = [];

  try {
    [conversations, agents, tools] = await Promise.all([
      client.getConversations({ limit: 50, source }).catch((e) => {
        console.error('[ChatPage] Failed to load conversations:', e.name === 'AbortError' ? 'Request timed out' : e.message);
        return [];
      }),
      client.getAgents().catch((e) => {
        console.error('[ChatPage] Failed to load agents:', e.name === 'AbortError' ? 'Request timed out' : e.message);
        return [];
      }),
      client.getTools().catch((e) => {
        console.error('[ChatPage] Failed to load tools:', e.name === 'AbortError' ? 'Request timed out' : e.message);
        return [];
      }),
    ]);
  } catch (e: any) {
    console.error('[ChatPage] Failed to fetch initial data:', e.name === 'AbortError' ? 'Request timed out' : e.message);
  }

  // Load initial conversation messages if specified
  let initialMessages: any[] = [];
  let currentConversation = null;
  
  try {
    if (initialConversationId) {
      const conv = conversations.find((c: any) => c.id === initialConversationId);
      if (conv) {
        const loadedMessages = await client.getMessages(initialConversationId, { limit: 100 });
        currentConversation = conv;
        initialMessages = loadedMessages;
      }
    }
  } catch (e: any) {
    console.error('[ChatPage] Failed to load messages:', e.name === 'AbortError' ? 'Request timed out' : e.message);
    currentConversation = null;
    initialMessages = [];
  }

  // Get insight stats if showing insights
  let insightStats = null;
  if (showInsights) {
    try {
      insightStats = await client.getInsightStats();
    } catch (e) {
      // Insights may not be available
    }
  }

  return (
    <ChatContainer
      initialConversations={conversations}
      initialMessages={initialMessages}
      initialConversation={currentConversation}
      availableAgents={agents}
      availableTools={tools}
      insightStats={insightStats}
      showInsights={showInsights}
      allowConversationManagement={allowConversationManagement}
      source={source}
      conversationQueryParam={conversationQueryParam}
      className={className}
    />
  );
}
