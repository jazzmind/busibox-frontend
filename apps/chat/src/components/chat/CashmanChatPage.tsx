/**
 * Cashman Chat Page — server component.
 *
 * Fetches initial conversation list + (optional) initial conversation messages
 * server-side, then hands off to the client-side CashmanChatShell.
 */

import { Suspense } from 'react';
import type { AgentClient } from '@jazzmind/busibox-app/lib/agent';
import { CashmanChatShell } from './CashmanChatShell';

export interface CashmanChatPageProps {
  client: AgentClient;
  initialConversationId?: string;
  source?: string;
  conversationQueryParam?: string;
}

export async function CashmanChatPage(props: CashmanChatPageProps) {
  return (
    <Suspense fallback={<ChatShellSkeleton />}>
      <CashmanChatPageContent {...props} />
    </Suspense>
  );
}

function ChatShellSkeleton() {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ backgroundColor: 'var(--cashman-bg)', color: 'var(--cashman-text-muted)' }}
    >
      Loading Cashman AI…
    </div>
  );
}

async function CashmanChatPageContent({
  client,
  initialConversationId,
  source,
  conversationQueryParam,
}: CashmanChatPageProps) {
  // Fetch conversations + agents in parallel. Agents are needed so we can
  // pass the default "chat" agent ID with each message — the backend rejects
  // requests without an agent context (falls through to using the literal
  // string "chat" as a model name, which LiteLLM rejects with a 400).
  let conversations: any[] = [];
  let agents: any[] = [];
  try {
    [conversations, agents] = await Promise.all([
      client.getConversations({ limit: 50, source }).catch((e: any) => {
        console.error(
          '[CashmanChatPage] Failed to load conversations:',
          e?.name === 'AbortError' ? 'Request timed out' : e?.message,
        );
        return [];
      }),
      client.getAgents().catch((e: any) => {
        console.error(
          '[CashmanChatPage] Failed to load agents:',
          e?.name === 'AbortError' ? 'Request timed out' : e?.message,
        );
        return [];
      }),
    ]);
  } catch (e: any) {
    console.error('[CashmanChatPage] initial fetch failed:', e?.message);
  }

  // Pick the default chat agent (matches shared ChatContainer's default logic).
  const chatAgent = agents.find(
    (a: any) =>
      (a.name === 'chat' || a.name === 'chat-agent' || a.name === 'chat_agent') &&
      a.is_active,
  );
  const defaultAgentIds = chatAgent ? [chatAgent.id] : [];

  let initialMessages: any[] = [];
  let currentConversation: any = null;
  try {
    if (initialConversationId) {
      const conv = conversations.find((c: any) => c.id === initialConversationId);
      if (conv) {
        const loaded = await client.getMessages(initialConversationId, {
          limit: 100,
        });
        currentConversation = conv;
        initialMessages = loaded;
      }
    }
  } catch (e: any) {
    console.error('[CashmanChatPage] load messages failed:', e?.message);
  }

  return (
    <CashmanChatShell
      initialConversations={conversations}
      initialMessages={initialMessages}
      initialConversation={currentConversation}
      defaultAgentIds={defaultAgentIds}
      source={source}
      conversationQueryParam={conversationQueryParam}
    />
  );
}
