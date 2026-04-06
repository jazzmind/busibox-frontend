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
import { getPublicConfig } from '../../lib/config/client';
import { ChatContainer } from './ChatContainer';
import { ChatSkeleton } from './ChatSkeleton';

export interface ChatPageProps {
  /** Server-side agent client */
  client: AgentClient;
  /** Show insights panel (default: true) */
  showInsights?: boolean;
  /** Override platform insights_enabled flag (reads from config-api if not provided) */
  insightsEnabled?: boolean;
  /** Allow conversation management (default: true) */
  allowConversationManagement?: boolean;
  /** Initial conversation ID to load */
  initialConversationId?: string;
  /** Source identifier for filtering/creating conversations (e.g., 'busibox-portal', 'busibox-agents') */
  source?: string;
  /** URL query parameter name for persisting the active conversation (default: 'conversation') */
  conversationQueryParam?: string;
  /** Show the agent selector button and panel (default: true) */
  showAgentSelector?: boolean;
  /** Custom CSS class */
  className?: string;
}

export async function ChatPage({
  client,
  showInsights = true,
  insightsEnabled,
  allowConversationManagement = true,
  initialConversationId,
  source,
  conversationQueryParam,
  showAgentSelector = true,
  className,
}: ChatPageProps) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatPageContent
        client={client}
        showInsights={showInsights}
        insightsEnabledOverride={insightsEnabled}
        allowConversationManagement={allowConversationManagement}
        initialConversationId={initialConversationId}
        source={source}
        conversationQueryParam={conversationQueryParam}
        showAgentSelector={showAgentSelector}
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
  insightsEnabledOverride,
  allowConversationManagement,
  initialConversationId,
  source,
  conversationQueryParam,
  showAgentSelector,
  className,
}: {
  client: AgentClient;
  showInsights: boolean;
  insightsEnabledOverride?: boolean;
  allowConversationManagement: boolean;
  initialConversationId?: string;
  source?: string;
  conversationQueryParam?: string;
  showAgentSelector?: boolean;
  className?: string;
}) {
  // Resolve platform insights_enabled flag
  let insightsEnabled = insightsEnabledOverride;
  if (insightsEnabled === undefined) {
    try {
      const publicConfig = await getPublicConfig();
      insightsEnabled = publicConfig.insights_enabled !== 'false';
    } catch {
      insightsEnabled = true;
    }
  }

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

  // Get insight stats if showing insights and platform-enabled
  let insightStats = null;
  if (showInsights && insightsEnabled) {
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
      insightsEnabled={insightsEnabled}
      allowConversationManagement={allowConversationManagement}
      source={source}
      conversationQueryParam={conversationQueryParam}
      showAgentSelector={showAgentSelector}
      className={className}
    />
  );
}
