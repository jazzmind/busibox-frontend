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
import { getActiveTurn } from '@jazzmind/busibox-app/lib/agent/chat-client';
import { useCrossAppApiPath } from '@jazzmind/busibox-app/contexts';
import type {
  Conversation,
  Message,
  MessageAttachment,
  MessagePart,
} from '@jazzmind/busibox-app/types/chat';
import { stripThinkTags } from '@jazzmind/busibox-app/components/chat/chat-utils';

import { MarineSidebar } from './Sidebar';
import { MarineEmptyState } from './EmptyState';
import { MarineMessages } from './Messages';
import { MarineComposer } from './Composer';
import { MarineQuickReplies } from './QuickReplies';
import { MarineSourcePanel } from './SourcePanel';
import { MarineDebugToggle, useDebugMode } from './DebugToggle';
import { MarineNotifyToggle } from './NotifyToggle';
import { MarineMemoryToggle } from './MemoryToggle';
import { MarineMemoryPanel } from './MemoryPanel';
import { MarineShareButton } from './ShareButton';
import { Eye } from 'lucide-react';

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
    lastMessage: conv.last_message
      ? {
          role: conv.last_message.role,
          content: conv.last_message.content ?? '',
          createdAt: new Date(conv.last_message.created_at),
        }
      : conv.lastMessage,
    messageCount: conv.message_count ?? conv.messageCount ?? 0,
    model: conv.model,
    metadata: conv.metadata,
    linkAccess: conv.link_access ?? conv.linkAccess,
    accessRole: conv.access_role ?? conv.accessRole ?? undefined,
  };
}

/**
 * Rebuild `tool_call` parts for a stored assistant message so the activity
 * summary ("Searched documents · Searched the web") also shows for history.
 *
 * The agentic stream endpoint persists tool events inside
 * `routing_decision.thoughts` as `{type:'tool_result', source, message, data?}`;
 * the legacy endpoints persist raw `tool_result` payloads in `tool_calls`.
 * Both are handled; live-streamed `parts` win when present.
 */
function partsFromStoredMessage(msg: any, existing?: MessagePart[]): MessagePart[] | undefined {
  if (existing && existing.length) return existing;
  const out: MessagePart[] = [];

  const thoughts: any[] = msg?.routing_decision?.thoughts || msg?.thoughts || [];
  thoughts.forEach((t: any, i: number) => {
    if (t?.type !== 'tool_result') return;
    const data = t.data || {};
    const name = String(data.tool_name || t.source || 'tool');
    const failed = data.success === false;
    out.push({
      type: 'tool_call' as const,
      id: `stored-thought-${i}-${name}`,
      name,
      displayName: String(data.display_name || name),
      status: failed ? ('error' as const) : ('completed' as const),
      error: failed ? String(t.message || 'Failed') : undefined,
    });
  });
  if (out.length) return out;

  const toolCalls: any[] = msg?.tool_calls || msg?.toolCalls || [];
  toolCalls.forEach((tc: any, i: number) => {
    // Legacy shape: the event payload itself ({tool_name, success, ...}),
    // sometimes wrapped as {source, data:{...}}.
    const data = tc?.data && typeof tc.data === 'object' ? tc.data : tc || {};
    const name = String(data.tool_name || data.display_name || tc?.source || 'tool');
    const failed = data.success === false;
    out.push({
      type: 'tool_call' as const,
      id: `stored-tool-${i}-${name}`,
      name,
      displayName: String(data.display_name || name),
      status: failed ? ('error' as const) : ('completed' as const),
      error: failed ? String(tc?.message || data.error || 'Failed') : undefined,
    });
  });
  return out.length ? out : undefined;
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
    parts: partsFromStoredMessage(msg, msg.parts),
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
  source,
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
  const [memoryOpen, setMemoryOpen] = useState(false);
  // Bumped to ask the composer to focus its textarea ("Something else…" chip).
  const [composerFocusSignal, setComposerFocusSignal] = useState(0);
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

  // The turn id of the stream in flight, readable from async closures that
  // were created before it arrived.
  const streamTurnIdRef = useRef<string | undefined>(undefined);

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
    resumeTurn: hookResumeTurn,
    cancel: hookCancel,
    resetPrompt: hookResetPrompt,
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

  useEffect(() => {
    streamTurnIdRef.current = streamState.turnId;
  }, [streamState.turnId]);

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
      hookResetPrompt();
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
    [apiCall, hookResetPrompt, updateUrl],
  );

  const reloadMessages = useCallback(
    async (convId: string) => {
      try {
        const res = await apiCall(`/chat/${convId}/history`);
        const data = await res.json();
        if (currentConversationRef.current === convId) {
          setMessages((data.messages || []).map(mapMessage));
        }
      } catch (e) {
        console.error('Failed to reload messages', e);
      }
    },
    [apiCall],
  );

  // A turn that is still running on the server (this tab reloaded, the
  // laptop slept, or another tab started it): attach to its stream, then
  // reload the persisted messages once it finishes.
  const resumingRef = useRef<string | null>(null);
  const resumeActiveTurn = useCallback(
    async (convId: string) => {
      if (resumingRef.current === convId || streamState.isStreaming) return;
      try {
        const turn = await getActiveTurn(convId, { token: '', agentUrl });
        if (!turn || turn.status !== 'running' || currentConversationRef.current !== convId) return;
        resumingRef.current = convId;
        toast('Reconnecting to a response that is still in progress…', { icon: '⏳' });
        await hookResumeTurn(turn.id, convId);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.error('Failed to resume turn', e);
        }
      } finally {
        if (resumingRef.current === convId) resumingRef.current = null;
        if (currentConversationRef.current === convId) {
          await reloadMessages(convId);
        }
      }
    },
    [agentUrl, hookResumeTurn, reloadMessages, streamState.isStreaming],
  );

  useEffect(() => {
    const convId = currentConversation?.id;
    if (!convId) return;
    void resumeActiveTurn(convId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversation?.id]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const convId = currentConversationRef.current;
      if (convId && !streamState.isStreaming) void resumeActiveTurn(convId);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [resumeActiveTurn, streamState.isStreaming]);

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

        if (result.status && result.status !== 'completed') {
          // Stopped / failed / interrupted: the server stored the partial
          // answer with a marker; show exactly what it kept.
          await reloadMessages(convId);
          return;
        }

        const cleaned = stripThinkTags(result.content);
        if (cleaned) {
          const assistant: Message = {
            id: `assistant-${Date.now()}`,
            conversationId: result.conversationId || convId,
            role: 'assistant',
            content: cleaned,
            agentName: result.agentName,
            citations: result.citations.length > 0 ? result.citations : undefined,
            thoughts: result.thoughts?.length ? result.thoughts : undefined,
            parts: result.parts?.length ? result.parts : undefined,
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
        if (e?.name === 'AbortError') {
          // Stopped by the user: the server keeps the partial answer; show it.
          await reloadMessages(convId);
          return;
        }
        console.error(e);
        if (streamTurnIdRef.current) {
          // The turn was accepted and is still running server-side; only the
          // stream was lost. The question is already saved, the answer will
          // be too, and an email follows if it finishes while we are away.
          toast(
            'Connection lost — the response is still being generated. Reopen this conversation to see it, or wait for the email.',
            { icon: '📡', duration: 8000 },
          );
          await reloadMessages(convId);
          return;
        }
        toast.error(e?.message || 'Failed to send message');
        setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
      }
    },
    [apiCall, ensureConversation, hookSendMessage, reloadMessages, source, defaultAgentIds],
  );

  // Read through refs so the callback identity is stable — it is a prop of
  // every memoised AssistantMessage, and a new identity per stream chunk
  // would re-render the whole history.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const streamingCitationsRef = useRef(streamState.citations);
  streamingCitationsRef.current = streamState.citations;

  const handleCitationClick = useCallback((fileId: string, page?: number) => {
    // Try to find filename from the clicked source first, then any older assistant citation.
    const lastCitations =
      [...messagesRef.current].reverse().find((m) => m.role === 'assistant' && m.citations)
        ?.citations || [];
    const streamingMatch = streamingCitationsRef.current.find(
      (c) => c.fileId === fileId && (page === undefined || c.page === page),
    );
    const match = lastCitations.find(
      (c) => c.fileId === fileId && (page === undefined || c.page === page),
    );
    setOpenCitation({ fileId, page, filename: streamingMatch?.filename || match?.filename });
  }, []);

  const activeCitation = useMemo(
    () => (openCitation ? { fileId: openCitation.fileId, page: openCitation.page } : null),
    [openCitation?.fileId, openCitation?.page], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The prompt event carries confirm | choice | open; the chips render differently.
  const promptMode = useMemo(() => {
    for (let i = streamState.parts.length - 1; i >= 0; i--) {
      const part = streamState.parts[i];
      if (part.type === 'prompt') return part.promptType;
    }
    return undefined;
  }, [streamState.parts]);

  const conversationTitle =
    currentConversation?.title ||
    (messages.length > 0 ? 'Conversation' : 'New Conversation');

  const isStreaming = streamState.isStreaming;
  const showEmpty = messages.length === 0 && !isStreaming && !streamState.content;
  // Someone who opened this chat through a share link (or a viewer share) can
  // read but not send. Owners and editors get the full UI.
  const isViewer = currentConversation?.accessRole === 'viewer';
  const canShare = !!currentConversation && !isViewer && currentConversation.accessRole !== 'editor';
  // Yes/No (etc.) chips for the assistant's pending question. The stream hook
  // clears these itself when the next message is sent.
  const showQuickReplies =
    !isViewer &&
    !isStreaming &&
    streamState.promptActive &&
    streamState.quickReplies.length > 0 &&
    streamState.conversationId === currentConversation?.id;

  const handleConversationUpdated = useCallback((conv: Conversation) => {
    setCurrentConversation((prev) => (prev && prev.id === conv.id ? { ...prev, ...conv } : prev));
    setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c)));
  }, []);

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
          <div className="flex items-center gap-1">
            {canShare && (
              <MarineShareButton
                conversation={currentConversation}
                apiCall={apiCall}
                onUpdated={handleConversationUpdated}
                queryParam={conversationQueryParam}
              />
            )}
            <MarineNotifyToggle apiCall={apiCall} />
            <MarineMemoryToggle open={memoryOpen} onToggle={() => setMemoryOpen((v) => !v)} />
            <MarineDebugToggle
              enabled={debugMode}
              onToggle={() => setDebugMode(!debugMode)}
            />
          </div>
        </div>

        <div className="relative flex flex-1 flex-col overflow-hidden">
          {streamState.reconnecting && (
            <div
              className="flex items-center gap-2 border-b px-6 py-2 text-[13px]"
              style={{
                borderColor: 'var(--marine-border)',
                backgroundColor: 'var(--marine-surface)',
                color: 'var(--marine-text-muted)',
              }}
              role="status"
            >
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Connection lost — reconnecting to the response in progress…
            </div>
          )}
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
            ) : showEmpty && !isViewer ? (
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
                activeCitation={activeCitation}
                onCitationClick={handleCitationClick}
              />
            )}
          </div>

          {showQuickReplies && (
            <MarineQuickReplies
              replies={streamState.quickReplies}
              mode={promptMode}
              onSelect={(reply) => void handleSendMessage(reply)}
              onOther={() => {
                hookResetPrompt();
                setComposerFocusSignal((n) => n + 1);
              }}
            />
          )}

          {isViewer ? (
            <div
              className="mx-auto flex w-full max-w-[820px] items-center gap-2 px-5 pb-5 pt-3 text-sm"
              style={{ color: 'var(--marine-text-muted)' }}
              role="status"
            >
              <Eye className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--marine-teal)' }} />
              <span>
                You're viewing a chat shared by a coworker. It's read-only — start a{' '}
                <button
                  type="button"
                  onClick={handleCreateConversation}
                  className="font-medium underline-offset-2 hover:underline"
                  style={{ color: 'var(--marine-teal-dark)' }}
                >
                  new chat
                </button>{' '}
                to ask your own questions.
              </span>
            </div>
          ) : (
            <MarineComposer
              onSend={handleSendMessage}
              onStop={hookCancel}
              isStreaming={isStreaming}
              conversationId={currentConversation?.id}
              onEnsureConversation={ensureConversation}
              focusSignal={composerFocusSignal}
            />
          )}
        </div>
      </div>

      {memoryOpen && <MarineMemoryPanel apiCall={apiCall} onClose={() => setMemoryOpen(false)} />}

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
