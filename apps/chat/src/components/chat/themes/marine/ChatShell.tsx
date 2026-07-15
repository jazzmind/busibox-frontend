'use client';

/**
 * Marine Chat Shell — client orchestrator for the Marine-branded chat UI.
 *
 * Owns:
 *   - conversation list + selection state
 *   - message history
 *   - streaming via useChatStream (shared)
 *   - source-document side panel (opens on citation click)
 *   - collapse/expand of left sidebar
 *
 * Deliberately does NOT render:
 *   - insights panel, agent selector, tools selector, tasks panel
 *   - streaming thought/tool-call visualizations
 * These live in the shared ChatContainer for other apps.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useChatStream } from '@jazzmind/busibox-app/lib/hooks/useChatStream';
import { useCrossAppApiPath } from '@jazzmind/busibox-app/contexts';
import type {
  Conversation,
  Message,
  MessageAttachment,
} from '@jazzmind/busibox-app/types/chat';
import { stripThinkTags } from '@jazzmind/busibox-app/components/chat/chat-utils';

import { MarineSidebar } from './Sidebar';
import { MarineEmptyState } from './EmptyState';
import { MarineMessages } from './Messages';
import { MarineComposer } from './Composer';
import { MarineSourcePanel } from './SourcePanel';
import { MarineDebugToggle, useDebugMode } from './DebugToggle';

function mapConversation(conv: any): Conversation {
  return {
    id: conv.id,
    userId: conv.user_id || conv.userId,
    title: conv.title,
    source: conv.source,
    createdAt: conv.created_at ? new Date(conv.created_at) : conv.createdAt,
    updatedAt: conv.updated_at ? new Date(conv.updated_at) : conv.updatedAt,
    lastMessageAt: conv.last_message?.created_at
      ? new Date(conv.last_message.created_at)
      : conv.lastMessageAt,
    messageCount: conv.message_count ?? conv.messageCount ?? 0,
    model: conv.model,
    metadata: conv.metadata,
  };
}

function mapMessage(msg: any): Message {
  const rawCitations: any[] = msg.routing_decision?.citations || [];
  return {
    id: msg.id,
    conversationId: msg.conversation_id || msg.conversationId,
    role: msg.role,
    content: msg.content,
    model: msg.model,
    agentName: msg.agent_name || msg.agentName,
    thoughts: msg.routing_decision?.thoughts || msg.thoughts,
    routingDecision: msg.routing_decision || msg.routingDecision,
    toolCalls: msg.tool_calls || msg.toolCalls,
    runId: msg.run_id || msg.runId,
    attachments: (msg.chat_attachments || msg.attachments || []).map((a: any) => ({
      id: a.id,
      filename: a.filename,
      fileUrl: a.file_url || a.fileUrl || '',
      mimeType: a.mime_type || a.mimeType || 'application/octet-stream',
      sizeBytes: a.size_bytes ?? a.sizeBytes,
      addedToLibrary: a.added_to_library ?? a.addedToLibrary,
    })),
    citations: rawCitations
      .map((c: any) => ({
        fileId: c.file_id || c.fileId,
        filename: c.filename || c.title || 'Source',
        page: c.page_number ?? c.page ?? undefined,
        score: c.score ?? undefined,
        snippet: c.snippet || c.text || c.content || c.chunk_text || undefined,
        source: c.source || c.library_name || c.libraryName || undefined,
      }))
      .filter((c: any) => !!c.fileId),
    createdAt: msg.created_at ? new Date(msg.created_at) : msg.createdAt,
  };
}

export interface MarineChatShellProps {
  initialConversations: Conversation[];
  initialMessages: Message[];
  initialConversation: Conversation | null;
  /** Agent IDs to send with every message. The backend requires at least one
   *  active agent context; empty causes a 400 from LiteLLM. */
  defaultAgentIds?: string[];
  source?: string;
  conversationQueryParam?: string;
}

export function MarineChatShell({
  initialConversations,
  initialMessages,
  initialConversation,
  defaultAgentIds = [],
  source = 'marine-chat',
  conversationQueryParam = 'conversation',
}: MarineChatShellProps) {
  const resolve = useCrossAppApiPath();

  const [collapsed, setCollapsed] = useState(false);
  const [debugMode, setDebugMode] = useDebugMode();
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(
    initialConversation,
  );
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [openCitation, setOpenCitation] = useState<{
    fileId: string;
    page?: number;
    filename?: string;
  } | null>(null);

  const currentConversationRef = useRef<string | null>(
    initialConversation?.id ?? null,
  );

  useEffect(() => {
    currentConversationRef.current = currentConversation?.id ?? null;
  }, [currentConversation]);

  const agentUrl = useMemo(() => resolve('agent', '/api/agent'), [resolve]);

  const updateUrl = useCallback(
    (conversationId: string | null) => {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      if (conversationId) {
        url.searchParams.set(conversationQueryParam, conversationId);
      } else {
        url.searchParams.delete(conversationQueryParam);
      }
      window.history.replaceState({}, '', url.toString());
    },
    [conversationQueryParam],
  );

  const {
    state: streamState,
    sendMessage: hookSendMessage,
    cancel: hookCancel,
  } = useChatStream({
    token: '',
    agentUrl,
    onConversationCreated: (id, title) => {
      if (title) {
        setConversations((prev) => {
          const existing = prev.find((c) => c.id === id);
          if (existing) return prev.map((c) => (c.id === id ? { ...c, title } : c));
          const newConv: Conversation = {
            id,
            userId: '',
            title,
            source,
            createdAt: new Date(),
            updatedAt: new Date(),
            messageCount: 0,
          };
          return [newConv, ...prev];
        });
      }
      currentConversationRef.current = id;
      setCurrentConversation((prev) => ({
        id,
        userId: prev?.userId || '',
        title: title || prev?.title || 'New Conversation',
        source: prev?.source ?? source,
        createdAt: prev?.createdAt || new Date(),
        updatedAt: new Date(),
        messageCount: prev?.messageCount ?? 0,
        model: prev?.model,
        metadata: prev?.metadata,
      }));
      updateUrl(id);
    },
    onTitleUpdate: (id, title) => {
      setCurrentConversation((prev) =>
        prev && prev.id === id ? { ...prev, title } : prev,
      );
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    },
  });

  const apiCall = useCallback(
    async (endpoint: string, options?: RequestInit) => {
      const response = await fetch(resolve('agent', `/api/agent${endpoint}`), {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });
      if (!response.ok) {
        const err = await response.text().catch(() => 'Unknown error');
        throw new Error(err);
      }
      return response;
    },
    [resolve],
  );

  const handleSelectConversation = useCallback(
    async (conv: Conversation) => {
      currentConversationRef.current = conv.id;
      setCurrentConversation(conv);
      updateUrl(conv.id);
      setIsLoadingMessages(true);
      try {
        const res = await apiCall(`/chat/${conv.id}/history`);
        const data = await res.json();
        const mapped = (data.messages || []).map(mapMessage);
        if (currentConversationRef.current === conv.id) {
          setMessages(mapped);
        }
      } catch (e) {
        console.error('Failed to load messages', e);
        toast.error('Failed to load messages');
      } finally {
        if (currentConversationRef.current === conv.id) {
          setIsLoadingMessages(false);
        }
      }
    },
    [apiCall, updateUrl],
  );

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (currentConversation?.id) return currentConversation.id;
    try {
      const res = await apiCall('/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Conversation', source }),
      });
      const newConv = mapConversation(await res.json());
      currentConversationRef.current = newConv.id;
      setConversations((prev) => [newConv, ...prev]);
      setCurrentConversation(newConv);
      setMessages([]);
      updateUrl(newConv.id);
      return newConv.id;
    } catch (e) {
      console.error('Failed to create conversation', e);
      toast.error('Failed to create conversation');
      return null;
    }
  }, [apiCall, currentConversation, source, updateUrl]);

  const handleCreateConversation = useCallback(async () => {
    try {
      const res = await apiCall('/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Conversation', source }),
      });
      const newConv = mapConversation(await res.json());
      currentConversationRef.current = newConv.id;
      setConversations((prev) => [newConv, ...prev]);
      setCurrentConversation(newConv);
      setMessages([]);
      updateUrl(newConv.id);
    } catch (e) {
      console.error(e);
      toast.error('Failed to create conversation');
    }
  }, [apiCall, source, updateUrl]);

  const handleDeleteConversation = useCallback(
    async (conv: Conversation) => {
      // Optimistic remove — snap the row out of the list before the request
      // resolves so the click feels instant. Restore on failure.
      const snapshot = { conversations, currentConversation };
      const wasCurrent = currentConversation?.id === conv.id;
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (wasCurrent) {
        currentConversationRef.current = null;
        setCurrentConversation(null);
        setMessages([]);
        updateUrl(null);
      }

      try {
        await apiCall(`/conversations/${conv.id}`, { method: 'DELETE' });
        toast.success('Conversation deleted');
      } catch (e: any) {
        console.error('Failed to delete conversation', e);
        toast.error(e?.message || 'Failed to delete conversation');
        // Roll back
        setConversations(snapshot.conversations);
        if (wasCurrent && snapshot.currentConversation) {
          setCurrentConversation(snapshot.currentConversation);
          currentConversationRef.current = snapshot.currentConversation.id;
          updateUrl(snapshot.currentConversation.id);
        }
      }
    },
    [apiCall, conversations, currentConversation, updateUrl],
  );

  const handleSendMessage = useCallback(
    async (
      content: string,
      attachmentIds?: string[],
      attachmentMeta?: MessageAttachment[],
    ) => {
      const trimmed = content.trim();
      if (!trimmed && (!attachmentIds || attachmentIds.length === 0)) return;
      const convId = await ensureConversation();
      if (!convId) return;

      const tempUser: Message = {
        id: `temp-${Date.now()}`,
        conversationId: convId,
        role: 'user',
        content: trimmed,
        attachments: attachmentMeta,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, tempUser]);

      try {
        const browserContext: Record<string, string> = {};
        if (typeof window !== 'undefined') {
          try {
            browserContext.timezone =
              Intl.DateTimeFormat().resolvedOptions().timeZone;
            browserContext.locale = navigator.language;
          } catch {
            /* ignore */
          }
        }

        const result = await hookSendMessage({
          message: trimmed || ' ',
          conversation_id: convId,
          model: 'auto',
          selected_agents: defaultAgentIds,
          attachment_ids: attachmentIds,
          metadata: { user_context: browserContext },
        });

        const cleaned = stripThinkTags(result.content);
        if (cleaned) {
          const assistant: Message = {
            id: `assistant-${Date.now()}`,
            conversationId: result.conversationId || convId,
            role: 'assistant',
            content: cleaned,
            agentName: result.agentName,
            citations: result.citations.length > 0 ? result.citations : undefined,
            createdAt: new Date(),
          };
          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => m.id !== tempUser.id);
            return [
              ...withoutTemp,
              { ...tempUser, id: `user-${Date.now()}` },
              assistant,
            ];
          });
        }

        // Refresh conversations for updated timestamps + titles
        const convUrl = source
          ? `/conversations?source=${encodeURIComponent(source)}`
          : '/conversations';
        const convRes = await apiCall(convUrl);
        const convData = await convRes.json();
        const raw = convData.conversations || convData || [];
        setConversations(raw.map(mapConversation));
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error(e);
        toast.error(e?.message || 'Failed to send message');
        setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
      }
    },
    [apiCall, ensureConversation, hookSendMessage, source, defaultAgentIds],
  );

  const handleCitationClick = useCallback(
    (fileId: string, page?: number) => {
      // Try to find filename from the clicked source first, then any older assistant citation.
      const lastCitations =
        [...messages].reverse().find((m) => m.role === 'assistant' && m.citations)
          ?.citations || [];
      const streamingMatch = streamState.citations.find(
        (c) => c.fileId === fileId && (page === undefined || c.page === page),
      );
      const match = lastCitations.find(
        (c) => c.fileId === fileId && (page === undefined || c.page === page),
      );
      setOpenCitation({ fileId, page, filename: streamingMatch?.filename || match?.filename });
    },
    [messages, streamState.citations],
  );

  const conversationTitle =
    currentConversation?.title ||
    (messages.length > 0 ? 'Conversation' : 'New Conversation');

  const isStreaming = streamState.isStreaming;
  const showEmpty = messages.length === 0 && !isStreaming && !streamState.content;

  return (
    <div
      className="relative flex h-full min-h-0 w-full"
      style={{ backgroundColor: 'var(--marine-bg)' }}
    >
      <MarineSidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        conversations={conversations}
        currentConversationId={currentConversation?.id ?? null}
        onSelectConversation={handleSelectConversation}
        onCreateConversation={handleCreateConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="flex h-12 items-center justify-between border-b bg-[var(--marine-surface)] px-6"
          style={{ borderColor: 'var(--marine-border)' }}
        >
          <h1
            className="truncate text-[18px] font-semibold tracking-tight"
            style={{ color: 'var(--marine-text)' }}
          >
            {conversationTitle}
          </h1>
          <MarineDebugToggle
            enabled={debugMode}
            onToggle={() => setDebugMode(!debugMode)}
          />
        </div>

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div
            data-chat-scroll="1"
            className="flex-1 overflow-y-auto"
          >
            {isLoadingMessages ? (
              <div
                className="flex h-full items-center justify-center"
                style={{ color: 'var(--marine-text-muted)' }}
              >
                Loading messages…
              </div>
            ) : showEmpty ? (
              <MarineEmptyState onPromptClick={handleSendMessage} />
            ) : (
              <MarineMessages
                messages={messages}
                streamingContent={streamState.content || undefined}
                streamingCitations={streamState.citations}
                streamingThoughts={streamState.thoughts}
                streamingParts={streamState.parts}
                streamingAgentName={streamState.agentName}
                isLoading={isStreaming}
                debugMode={debugMode}
                activeCitation={
                  openCitation
                    ? { fileId: openCitation.fileId, page: openCitation.page }
                    : null
                }
                onCitationClick={handleCitationClick}
              />
            )}
          </div>

          <MarineComposer
            onSend={handleSendMessage}
            onStop={hookCancel}
            isStreaming={isStreaming}
            conversationId={currentConversation?.id}
            onEnsureConversation={ensureConversation}
          />
        </div>
      </div>

      {openCitation && (
        <MarineSourcePanel
          fileId={openCitation.fileId}
          page={openCitation.page}
          filename={openCitation.filename}
          onClose={() => setOpenCitation(null)}
        />
      )}
    </div>
  );
}
