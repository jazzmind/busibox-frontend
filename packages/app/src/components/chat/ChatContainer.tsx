/**
 * Chat Container - Client Component
 * 
 * Interactive wrapper that receives server-rendered data and handles
 * all client-side state and interactions.
 */

'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Plus, MessageSquare, Trash2, Search, Brain, X, Sparkles, Bot, ListTodo } from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { AgentSelectionPanel } from './AgentSelectionPanel';
import { ThinkingToggle, ThoughtEvent } from './ThinkingToggle';
import { InsightEditModal, type InsightData } from './InsightEditModal';
import type {
  Conversation,
  Message,
  MessageAttachment,
  InsightSearchResult,
} from '../../types/chat';
import type { AgentDefinition, ToolDefinition } from '../../lib/agent/agent-service-client';
import { useIsMobile } from '../../lib/hooks/useIsMobile';

/**
 * Map snake_case API response to camelCase Conversation type
 */
function mapConversation(conv: any): Conversation {
  return {
    id: conv.id,
    userId: conv.user_id || conv.userId,
    title: conv.title,
    source: conv.source,
    createdAt: conv.created_at ? new Date(conv.created_at) : conv.createdAt,
    updatedAt: conv.updated_at ? new Date(conv.updated_at) : conv.updatedAt,
    lastMessageAt: conv.last_message?.created_at ? new Date(conv.last_message.created_at) : conv.lastMessageAt,
    messageCount: conv.message_count ?? conv.messageCount ?? 0,
    model: conv.model,
    metadata: conv.metadata,
  };
}

/**
 * Map snake_case API response to camelCase Message type
 * Extracts thoughts from routing_decision.thoughts
 */
function mapMessage(msg: any): Message {
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
    createdAt: msg.created_at ? new Date(msg.created_at) : msg.createdAt,
  };
}

interface StreamState {
  controller: AbortController;
  content: string;
  agentName?: string;
  thoughts: ThoughtEvent[];
  tempUserMessage: Message;
  hasAddedMessage: boolean;
  messages: Message[];
}

export interface ChatContainerProps {
  initialConversations: Conversation[];
  initialMessages: Message[];
  initialConversation: Conversation | null;
  availableAgents: AgentDefinition[];
  availableTools: ToolDefinition[];
  insightStats: { total: number; by_category: Record<string, number> } | null;
  showInsights: boolean;
  allowConversationManagement: boolean;
  /** Source identifier for filtering/creating conversations (e.g., 'busibox-portal', 'busibox-agents') */
  source?: string;
  /** URL query parameter name for persisting the active conversation (default: 'conversation') */
  conversationQueryParam?: string;
  className?: string;
}

export function ChatContainer({
  initialConversations,
  initialMessages,
  initialConversation,
  availableAgents,
  availableTools,
  insightStats: initialInsightStats,
  showInsights,
  allowConversationManagement,
  source,
  conversationQueryParam = 'conversation',
  className = '',
}: ChatContainerProps) {
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(initialConversation);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  /** Update the browser URL to reflect the active conversation without a page reload */
  const updateUrlWithConversation = useCallback((conversationId: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (conversationId) {
      url.searchParams.set(conversationQueryParam, conversationId);
    } else {
      url.searchParams.delete(conversationQueryParam);
    }
    window.history.replaceState({}, '', url.toString());
  }, [conversationQueryParam]);

  // Chat state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingAgentName, setStreamingAgentName] = useState<string | undefined>(undefined);
  const [thoughts, setThoughts] = useState<ThoughtEvent[]>([]);
  const [streamingConvIds, setStreamingConvIds] = useState<Set<string>>(new Set());
  const streamMapRef = useRef<Map<string, StreamState>>(new Map());
  const currentConversationRef = useRef<string | null>(initialConversation?.id ?? null);

  useEffect(() => {
    currentConversationRef.current = currentConversation?.id ?? null;
  }, [currentConversation]);

  useEffect(() => {
    return () => {
      for (const streamState of streamMapRef.current.values()) {
        streamState.controller.abort();
      }
      streamMapRef.current.clear();
    };
  }, []);

  const setConversationStreamingStatus = useCallback((conversationId: string, active: boolean) => {
    setStreamingConvIds(prev => {
      const next = new Set(prev);
      if (active) {
        next.add(conversationId);
      } else {
        next.delete(conversationId);
      }
      return next;
    });
  }, []);

  const isConversationActive = useCallback((conversationId: string) => {
    return currentConversationRef.current === conversationId;
  }, []);

  const applyStreamStateForConversation = useCallback((conversationId: string) => {
    const streamState = streamMapRef.current.get(conversationId);
    if (!streamState) {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingAgentName(undefined);
      setThoughts([]);
      return;
    }
    setIsStreaming(true);
    setStreamingContent(streamState.content);
    setStreamingAgentName(streamState.agentName);
    setThoughts(streamState.thoughts);
  }, []);

  // Memoize default agent selection to prevent infinite loop
  // Use agent IDs (UUIDs) not names for backend compatibility
  // Chat agent is the versatile general-purpose agent that should be the default
  const defaultAgents = useMemo(() => {
    // Try to find by various possible names
    const chatAgent = availableAgents.find(a => 
      (a.name === 'chat' || a.name === 'chat-agent' || a.name === 'chat_agent') && a.is_active
    );
    return chatAgent ? [chatAgent.id] : [];
  }, [availableAgents]);

  // Selection state - default to only "chat" agent (stores agent IDs)
  const [selectedAgents, setSelectedAgents] = useState<string[]>(defaultAgents);

  // Insights state
  const [showInsightsPanel, setShowInsightsPanel] = useState(false);
  const [insights, setInsights] = useState<InsightSearchResult[]>([]);
  const [insightStats, setInsightStats] = useState(initialInsightStats);
  const [insightSearchQuery, setInsightSearchQuery] = useState('');
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightCategoryFilter, setInsightCategoryFilter] = useState<string | null>(null);
  const [insightOffset, setInsightOffset] = useState(0);
  const [insightTotal, setInsightTotal] = useState(0);
  const [hasMoreInsights, setHasMoreInsights] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<InsightData | null>(null);
  const INSIGHT_PAGE_SIZE = 20;

  // Right panel states
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [showTasksPanel, setShowTasksPanel] = useState(false);

  // API calls via fetch to relative endpoints (proxied by the consuming app)
  const apiCall = useCallback(async (endpoint: string, options?: RequestInit) => {
    const response = await fetch(`/api/agent${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(error);
    }

    return response;
  }, []);

  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    currentConversationRef.current = conversation.id;
    setCurrentConversation(conversation);
    updateUrlWithConversation(conversation.id);
    applyStreamStateForConversation(conversation.id);
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
    setIsLoadingMessages(true);

    try {
      const response = await apiCall(`/chat/${conversation.id}/history`);
      const data = await response.json();
      const mappedMessages = (data.messages || []).map(mapMessage);
      if (currentConversationRef.current === conversation.id) {
        setMessages(mappedMessages);
        applyStreamStateForConversation(conversation.id);
      }
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    } finally {
      if (currentConversationRef.current === conversation.id) {
        setIsLoadingMessages(false);
      }
    }
  }, [apiCall, isMobile, updateUrlWithConversation, applyStreamStateForConversation]);

  /** Create a new conversation and return its ID, or null on failure.
   *  Shared by the "New Chat" button, send-message auto-create, and attachment auto-create. */
  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (currentConversation?.id) return currentConversation.id;
    try {
      const response = await apiCall('/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Conversation', source }),
      });
      const newConv = mapConversation(await response.json());
      currentConversationRef.current = newConv.id;
      setConversations(prev => [newConv, ...prev]);
      setCurrentConversation(newConv);
      setMessages([]);
      updateUrlWithConversation(newConv.id);
      return newConv.id;
    } catch (error: any) {
      console.error('Failed to create conversation:', error);
      toast.error('Failed to create conversation');
      return null;
    }
  }, [apiCall, source, currentConversation, updateUrlWithConversation]);

  const handleCreateConversation = useCallback(async () => {
    try {
      const response = await apiCall('/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Conversation', source }),
      });
      const newConv = mapConversation(await response.json());
      currentConversationRef.current = newConv.id;
      setConversations(prev => [newConv, ...prev]);
      setCurrentConversation(newConv);
      setMessages([]);
      applyStreamStateForConversation(newConv.id);
      updateUrlWithConversation(newConv.id);
      if (isMobile) {
        setMobileSidebarOpen(false);
      }
    } catch (error: any) {
      console.error('Failed to create conversation:', error);
      toast.error('Failed to create conversation');
    }
  }, [apiCall, source, isMobile, updateUrlWithConversation, applyStreamStateForConversation]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const streamState = streamMapRef.current.get(conversationId);
      if (streamState) {
        streamState.controller.abort();
        streamMapRef.current.delete(conversationId);
        setConversationStreamingStatus(conversationId, false);
      }

      await apiCall(`/conversations/${conversationId}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== conversationId));

      if (currentConversation?.id === conversationId) {
        currentConversationRef.current = null;
        setCurrentConversation(null);
        setMessages([]);
        updateUrlWithConversation(null);
      }

      toast.success('Conversation deleted');
    } catch (error: any) {
      console.error('Failed to delete conversation:', error);
      toast.error('Failed to delete conversation');
    }
  }, [apiCall, currentConversation, updateUrlWithConversation, setConversationStreamingStatus]);

  const handleSendMessage = useCallback(async (
    content: string,
    attachmentIds?: string[],
    attachmentMeta?: MessageAttachment[]
  ) => {
    if (!content.trim()) return;

    // Create conversation if none exists
    const convId = await ensureConversation();
    if (!convId) return;

    // Add user message optimistically
    let tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: convId,
      role: 'user',
      content,
      attachments: attachmentMeta,
      createdAt: new Date(),
    };
    if (isConversationActive(convId)) {
      setMessages(prev => [...prev, tempUserMessage]);
    }

    const controller = new AbortController();
    let streamConversationId = convId;

    streamMapRef.current.set(streamConversationId, {
      controller,
      content: '',
      thoughts: [],
      tempUserMessage,
      hasAddedMessage: false,
      messages: [tempUserMessage],
    });
    setConversationStreamingStatus(streamConversationId, true);

    if (isConversationActive(streamConversationId)) {
      setIsStreaming(true);
      setStreamingContent('');
      setStreamingAgentName(undefined);
      setThoughts([]);
    }

    // Track agent name in outer scope to persist across stream events
    let capturedAgentName: string | undefined;
    let fullContent = '';
    let collectedThoughts: ThoughtEvent[] = [];
    let hasAddedMessage = false;

    try {
      // Use agentic streaming endpoint for real-time thinking updates
      const response = await apiCall('/chat/message/stream/agentic', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          message: content,
          conversation_id: convId,
          model: 'auto',
          selected_agents: selectedAgents,
          attachment_ids: attachmentIds,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let eventType = '';
      let buffer = '';

      while (true) {
        if (controller.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data && eventType) {
              try {
                const parsed = JSON.parse(data);
                
                // Create thought event for tracking
                const newThought: ThoughtEvent = {
                  type: eventType,
                  source: parsed.source,
                  message: parsed.message,
                  data: parsed.data || parsed,
                  timestamp: new Date(),
                };

                // Extract agent name from source if available
                if (parsed.source && !parsed.source.includes('dispatcher')) {
                  capturedAgentName = parsed.source;
                  const streamState = streamMapRef.current.get(streamConversationId);
                  if (streamState) {
                    streamState.agentName = capturedAgentName;
                  }
                  if (isConversationActive(streamConversationId)) {
                    setStreamingAgentName(capturedAgentName);
                  }
                }

                switch (eventType) {
                  case 'conversation_created':
                    if (parsed.conversation_id) {
                      const newConversationId = parsed.conversation_id;
                      const previousConversationId = streamConversationId;

                      if (newConversationId !== previousConversationId) {
                        const currentStream = streamMapRef.current.get(previousConversationId);
                        if (currentStream) {
                          streamMapRef.current.delete(previousConversationId);
                          setConversationStreamingStatus(previousConversationId, false);

                          tempUserMessage = {
                            ...currentStream.tempUserMessage,
                            conversationId: newConversationId,
                          };
                          const migratedMessages = currentStream.messages.map(msg =>
                            msg.id === currentStream.tempUserMessage.id
                              ? tempUserMessage
                              : msg.conversationId === previousConversationId
                              ? { ...msg, conversationId: newConversationId }
                              : msg
                          );

                          streamMapRef.current.set(newConversationId, {
                            ...currentStream,
                            tempUserMessage,
                            messages: migratedMessages,
                          });
                          setConversationStreamingStatus(newConversationId, true);
                        }
                        streamConversationId = newConversationId;
                      }

                      if (parsed.title) {
                        setConversations(prev => {
                          const existing = prev.find(c => c.id === newConversationId);
                          if (existing) {
                            return prev.map(c =>
                              c.id === newConversationId ? { ...c, title: parsed.title } : c
                            );
                          }
                          const newConv: Conversation = {
                            id: newConversationId,
                            userId: '',
                            title: parsed.title,
                            source,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            messageCount: 0,
                          };
                          return [newConv, ...prev];
                        });
                      }

                      if (isConversationActive(previousConversationId) || isConversationActive(newConversationId)) {
                        currentConversationRef.current = newConversationId;
                        setCurrentConversation(prev =>
                          prev && prev.id !== previousConversationId
                            ? prev
                            : {
                                id: newConversationId,
                                userId: prev?.userId || '',
                                title: parsed.title || prev?.title || 'New Conversation',
                                source: prev?.source ?? source,
                                createdAt: prev?.createdAt || new Date(),
                                updatedAt: new Date(),
                                messageCount: prev?.messageCount ?? 0,
                                model: prev?.model,
                                metadata: prev?.metadata,
                              }
                        );
                        updateUrlWithConversation(newConversationId);
                      }
                    }
                    break;

                  case 'title_update':
                    // Update conversation title
                    if (parsed.conversation_id && parsed.title) {
                      setCurrentConversation(prev =>
                        prev && prev.id === parsed.conversation_id ? { ...prev, title: parsed.title } : prev
                      );
                      setConversations(prev => prev.map(c => 
                        c.id === parsed.conversation_id ? { ...c, title: parsed.title } : c
                      ));
                    }
                    break;

                  case 'thought':
                  case 'tool_start':
                  case 'tool_result':
                    // Add to thoughts section for ThinkingToggle
                    collectedThoughts = [...collectedThoughts, newThought];
                    {
                      const streamState = streamMapRef.current.get(streamConversationId);
                      if (streamState) {
                        streamState.thoughts = collectedThoughts;
                      }
                    }
                    if (isConversationActive(streamConversationId)) {
                      setThoughts(collectedThoughts);
                    }
                    break;

                  case 'content':
                    // Stream content to message area
                    const contentData = parsed.data || {};
                    const messageText = parsed.message || '';
                    
                    if (contentData.streaming && contentData.partial) {
                      // Append streaming chunk
                      fullContent += messageText;
                    } else if (contentData.complete) {
                      // Final marker - content already accumulated
                    } else if (messageText) {
                      // Non-streaming content - replace
                      fullContent = messageText;
                    }
                    {
                      const streamState = streamMapRef.current.get(streamConversationId);
                      if (streamState) {
                        streamState.content = fullContent;
                      }
                    }
                    if (isConversationActive(streamConversationId)) {
                      setStreamingContent(fullContent);
                    }
                    break;

                  case 'content_chunk':
                    // Legacy content chunk event (fallback)
                    fullContent += parsed.chunk || parsed.content || '';
                    {
                      const streamState = streamMapRef.current.get(streamConversationId);
                      if (streamState) {
                        streamState.content = fullContent;
                      }
                    }
                    if (isConversationActive(streamConversationId)) {
                      setStreamingContent(fullContent);
                    }
                    if (parsed.agent_name && !capturedAgentName) {
                      capturedAgentName = parsed.agent_name;
                      const streamState = streamMapRef.current.get(streamConversationId);
                      if (streamState) {
                        streamState.agentName = capturedAgentName;
                      }
                      if (isConversationActive(streamConversationId)) {
                        setStreamingAgentName(capturedAgentName);
                      }
                    }
                    break;

                  case 'message_complete':
                    // Only add message if we haven't already
                    if (!hasAddedMessage) {
                      const completedConversationId = parsed.conversation_id || streamConversationId;
                      
                      // Only add if there's actual content
                      if (fullContent.trim()) {
                        const assistantMessage: Message = {
                          id: parsed.message_id || `assistant-${Date.now()}`,
                          conversationId: completedConversationId,
                          role: 'assistant',
                          content: fullContent,
                          model: parsed.model,
                          agentName: parsed.agent_name || capturedAgentName,
                          thoughts: collectedThoughts.length > 0 ? collectedThoughts : undefined,
                          createdAt: new Date(),
                        };

                        if (isConversationActive(completedConversationId)) {
                          setMessages(prev => {
                            const withoutTemp = prev.filter(m => m.id !== tempUserMessage.id);
                            return [
                              ...withoutTemp,
                              { ...tempUserMessage, id: `user-${Date.now()}` },
                              assistantMessage,
                            ];
                          });
                        } else {
                          const streamState = streamMapRef.current.get(completedConversationId);
                          if (streamState) {
                            const withoutTemp = streamState.messages.filter(m => m.id !== tempUserMessage.id);
                            streamState.messages = [
                              ...withoutTemp,
                              { ...tempUserMessage, id: `user-${Date.now()}` },
                              assistantMessage,
                            ];
                          }
                        }
                        hasAddedMessage = true;
                        const streamState = streamMapRef.current.get(completedConversationId);
                        if (streamState) {
                          streamState.hasAddedMessage = true;
                        }
                      }

                      streamMapRef.current.delete(completedConversationId);
                      setConversationStreamingStatus(completedConversationId, false);

                      if (isConversationActive(completedConversationId)) {
                        setStreamingContent('');
                        setThoughts([]);
                        setStreamingAgentName(undefined);
                        setIsStreaming(false);
                      }
                    }
                    break;

                  case 'error':
                    const errorMessage = parsed.message || parsed.error || 'An error occurred';
                    if (isConversationActive(streamConversationId)) {
                      toast.error(errorMessage);
                    }
                    
                    if (!hasAddedMessage) {
                      const errorAssistantMessage: Message = {
                        id: `error-${Date.now()}`,
                        conversationId: streamConversationId,
                        role: 'assistant',
                        content: `⚠️ **Error:** ${errorMessage}`,
                        thoughts: collectedThoughts.length > 0 ? collectedThoughts : undefined,
                        createdAt: new Date(),
                      };
                      
                      if (isConversationActive(streamConversationId)) {
                        setMessages(prev => {
                          const withoutTemp = prev.filter(m => m.id !== tempUserMessage.id);
                          return [
                            ...withoutTemp,
                            { ...tempUserMessage, id: `user-${Date.now()}` },
                            errorAssistantMessage,
                          ];
                        });
                      } else {
                        const streamState = streamMapRef.current.get(streamConversationId);
                        if (streamState) {
                          const withoutTemp = streamState.messages.filter(m => m.id !== tempUserMessage.id);
                          streamState.messages = [
                            ...withoutTemp,
                            { ...tempUserMessage, id: `user-${Date.now()}` },
                            errorAssistantMessage,
                          ];
                        }
                      }
                      hasAddedMessage = true;
                      const streamState = streamMapRef.current.get(streamConversationId);
                      if (streamState) {
                        streamState.hasAddedMessage = true;
                      }
                    }

                    streamMapRef.current.delete(streamConversationId);
                    setConversationStreamingStatus(streamConversationId, false);

                    if (isConversationActive(streamConversationId)) {
                      setStreamingContent('');
                      setThoughts([]);
                      setStreamingAgentName(undefined);
                      setIsStreaming(false);
                    }
                    break;
                }
              } catch (e) {
                // Ignore parse errors for partial data
              }
            }
          }
        }
      }

      // Reload conversations to update timestamps (filter by source if set)
      if (!controller.signal.aborted) {
        const convUrl = source ? `/conversations?source=${encodeURIComponent(source)}` : '/conversations';
        const convResponse = await apiCall(convUrl);
        const convData = await convResponse.json();
        const rawConversations = convData.conversations || convData || [];
        setConversations(rawConversations.map(mapConversation));
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        // Aborted by user or conversation switch — not an error
        return;
      }
      console.error('Failed to send message:', error);
      if (isConversationActive(streamConversationId)) {
        toast.error(error.message || 'Failed to send message');
        setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      }
    } finally {
      const currentStream = streamMapRef.current.get(streamConversationId);
      if (currentStream?.controller === controller) {
        streamMapRef.current.delete(streamConversationId);
        setConversationStreamingStatus(streamConversationId, false);
      }
      if (isConversationActive(streamConversationId)) {
        applyStreamStateForConversation(streamConversationId);
      }
    }
  }, [
    apiCall,
    ensureConversation,
    selectedAgents,
    source,
    isConversationActive,
    setConversationStreamingStatus,
    applyStreamStateForConversation,
    updateUrlWithConversation,
  ]);

  const handleStopStreaming = useCallback(() => {
    const conversationId = currentConversationRef.current;
    if (!conversationId) return;

    const streamState = streamMapRef.current.get(conversationId);
    if (!streamState) return;

    streamState.controller.abort();
    streamMapRef.current.delete(conversationId);
    setConversationStreamingStatus(conversationId, false);
    applyStreamStateForConversation(conversationId);
  }, [setConversationStreamingStatus, applyStreamStateForConversation]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!currentConversation) {
      // No conversation - just remove from local state
      setMessages(prev => prev.filter(m => m.id !== messageId));
      return;
    }

    try {
      await apiCall(`/chat/${currentConversation.id}/messages/${messageId}`, {
        method: 'DELETE',
      });
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch (error: any) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  }, [apiCall, currentConversation]);

  const handleRetryMessage = useCallback(async (messageContent: string, attachmentIds?: string[]) => {
    // Capture attachment metadata from the original message before removing it
    let attachmentMeta: MessageAttachment[] | undefined;
    if (attachmentIds && attachmentIds.length > 0) {
      const userMsg = [...messages].reverse().find(m => m.role === 'user' && m.attachments?.length);
      if (userMsg?.attachments) {
        attachmentMeta = userMsg.attachments.filter(a => attachmentIds.includes(a.id));
      }
    }

    // Delete the last assistant message from local state
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      setMessages(prev => prev.slice(0, -1));
    }
    
    // Delete the user message that we're retrying from local state
    if (messages.length > 0) {
      const lastUserMsgIndex = [...messages].reverse().findIndex(m => m.role === 'user');
      if (lastUserMsgIndex !== -1) {
        const lastUserMsg = messages[messages.length - 1 - lastUserMsgIndex];
        setMessages(prev => prev.filter(m => m.id !== lastUserMsg.id));
      }
    }
    
    // Re-send with both attachment IDs (for the backend) and metadata (for the UI)
    await handleSendMessage(messageContent, attachmentIds, attachmentMeta);
  }, [messages, handleSendMessage]);

  // Load insights list (paginated, with optional category filter)
  const loadInsights = useCallback(async (category: string | null, offset: number, append: boolean = false) => {
    setIsLoadingInsights(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      params.set('offset', String(offset));
      params.set('limit', String(INSIGHT_PAGE_SIZE));
      
      const response = await apiCall(`/insights/list?${params.toString()}`);
      const data = await response.json();
      
      if (append) {
        setInsights(prev => [...prev, ...(data.results || [])]);
      } else {
        setInsights(data.results || []);
      }
      
      setInsightTotal(data.total || 0);
      setInsightStats(prev => prev ? { ...prev, by_category: data.by_category || {} } : null);
      setHasMoreInsights((offset + INSIGHT_PAGE_SIZE) < (data.total || 0));
      setInsightOffset(offset);
    } catch (error: any) {
      console.error('Failed to load insights:', error);
      // Don't show toast on initial load failure - might be expected
      if (offset > 0) {
        toast.error('Failed to load more insights');
      }
    } finally {
      setIsLoadingInsights(false);
    }
  }, [apiCall]);

  // Load more insights (infinite scroll)
  const loadMoreInsights = useCallback(() => {
    if (!isLoadingInsights && hasMoreInsights) {
      loadInsights(insightCategoryFilter, insightOffset + INSIGHT_PAGE_SIZE, true);
    }
  }, [isLoadingInsights, hasMoreInsights, insightCategoryFilter, insightOffset, loadInsights]);

  // Handle category filter click
  const handleCategoryFilter = useCallback((category: string | null) => {
    setInsightCategoryFilter(category);
    setInsightOffset(0);
    loadInsights(category, 0, false);
  }, [loadInsights]);

  const handleGenerateInsights = useCallback(async () => {
    if (!currentConversation) {
      toast.error('No conversation selected');
      return;
    }

    setIsLoadingInsights(true);
    try {
      const response = await apiCall(`/chat/${currentConversation.id}/generate-insights`, {
        method: 'POST',
      });
      const result = await response.json();
      const newCount = result.insights_generated || result.count || 0;
      const existingCount = result.existing_insights || 0;
      
      if (newCount > 0) {
        toast.success(`Generated ${newCount} new insights${existingCount > 0 ? ` (${existingCount} already existed)` : ''}`);
      } else if (existingCount > 0) {
        toast(`All ${existingCount} insights already exist`);
      } else {
        toast('No insights could be extracted from this conversation');
      }

      // Reload insights list and stats
      await loadInsights(insightCategoryFilter, 0, false);
      const statsResponse = await apiCall('/insights/stats/me');
      setInsightStats(await statsResponse.json());
    } catch (error: any) {
      console.error('Failed to generate insights:', error);
      toast.error('Failed to generate insights');
    } finally {
      setIsLoadingInsights(false);
    }
  }, [apiCall, currentConversation, insightCategoryFilter, loadInsights]);

  const handleSearchInsights = useCallback(async () => {
    if (!insightSearchQuery.trim()) {
      // If no search query, load all insights
      loadInsights(insightCategoryFilter, 0, false);
      return;
    }

    setIsLoadingInsights(true);
    try {
      const response = await apiCall('/insights/search', {
        method: 'POST',
        body: JSON.stringify({
          query: insightSearchQuery,
          limit: 20,
          conversation_id: currentConversation?.id,
        }),
      });
      const data = await response.json();
      setInsights(data.results || []);
      setInsightTotal(data.results?.length || 0);
      setHasMoreInsights(false); // Search results don't paginate

      if (!data.results?.length) {
        toast('No insights found');
      }
    } catch (error: any) {
      console.error('Failed to search insights:', error);
      toast.error('Failed to search insights');
    } finally {
      setIsLoadingInsights(false);
    }
  }, [apiCall, insightSearchQuery, currentConversation, insightCategoryFilter, loadInsights]);

  // Handle insight click - open modal
  const handleInsightClick = useCallback((result: InsightSearchResult) => {
    // Convert Date to string if needed for InsightData type
    const createdAt = result.insight?.createdAt;
    const createdAtStr = createdAt instanceof Date 
      ? createdAt.toISOString() 
      : createdAt;
    
    setSelectedInsight({
      id: result.insight?.id || '',
      content: result.insight?.content || '',
      category: result.insight?.category || 'other',
      conversationId: result.insight?.conversationId,
      createdAt: createdAtStr,
    });
  }, []);

  // Handle insight save
  const handleSaveInsight = useCallback(async (id: string, content: string, category: string) => {
    try {
      await apiCall(`/insights/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content, category }),
      });
      toast.success('Insight updated');
      // Refresh insights list
      await loadInsights(insightCategoryFilter, 0, false);
      // Update the selected insight
      setSelectedInsight(prev => prev ? { ...prev, content, category } : null);
    } catch (error: any) {
      console.error('Failed to save insight:', error);
      toast.error('Failed to save insight');
      throw error;
    }
  }, [apiCall, insightCategoryFilter, loadInsights]);

  // Handle insight delete
  const handleDeleteInsight = useCallback(async (id: string) => {
    try {
      await apiCall(`/insights/${id}`, {
        method: 'DELETE',
      });
      toast.success('Insight deleted');
      // Refresh insights list and stats
      await loadInsights(insightCategoryFilter, 0, false);
      const statsResponse = await apiCall('/insights/stats/me');
      setInsightStats(await statsResponse.json());
    } catch (error: any) {
      console.error('Failed to delete insight:', error);
      toast.error('Failed to delete insight');
      throw error;
    }
  }, [apiCall, insightCategoryFilter, loadInsights]);

  const handleForceInsight = useCallback(async () => {
    if (!currentConversation) {
      toast.error('No conversation selected');
      return;
    }

    const content = prompt('Enter insight content to add:');
    if (!content) return;

    try {
      const response = await apiCall('/insights', {
        method: 'POST',
        body: JSON.stringify({
          insights: [{
            content,
            category: 'fact',
            source: 'manual',
            conversation_id: currentConversation.id,
          }],
        }),
      });
      const result = await response.json();
      toast.success(`Added ${result.count || 1} insight`);

      // Reload insights list and stats
      await loadInsights(insightCategoryFilter, 0, false);
      const statsResponse = await apiCall('/insights/stats/me');
      setInsightStats(await statsResponse.json());
    } catch (error: any) {
      console.error('Failed to add insight:', error);
      toast.error('Failed to add insight');
    }
  }, [apiCall, currentConversation, insightCategoryFilter, loadInsights]);

  const conversationSidebar = (
    <div className="w-64 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Conversations</h2>
        {allowConversationManagement && (
          <button
            onClick={handleCreateConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        )}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                  currentConversation?.id === conv.id
                    ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => handleSelectConversation(conv)}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{conv.title || 'Untitled'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {conv.messageCount || 0} messages
                  </p>
                </div>
                {streamingConvIds.has(conv.id) && (
                  <span
                    className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0"
                    title="Thinking in background"
                  />
                )}
                {allowConversationManagement && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`flex h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Conversations Sidebar */}
      {!isMobile && conversationSidebar}
      {isMobile && mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative z-10">
            {conversationSidebar}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between gap-3">
            {/* Left side - Title, message count, and active agents */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isMobile && (
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="md:hidden p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                  title="Open conversations"
                  aria-label="Open conversations"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 12h18M3 18h18" />
                  </svg>
                </button>
              )}
              <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {currentConversation?.title || 'New Conversation'}
              </h3>
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{messages.length} messages</span>
                {selectedAgents.length > 0 && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="flex items-center gap-1 truncate">
                      {selectedAgents.slice(0, 2).map((agentId, idx) => {
                        const agent = availableAgents.find(a => a.id === agentId);
                        if (!agent) return null;
                        return (
                          <span key={agentId} className="text-blue-600 dark:text-blue-400">
                            {agent.display_name || agent.name}{idx < Math.min(selectedAgents.length, 2) - 1 ? ',' : ''}
                          </span>
                        );
                      })}
                      {selectedAgents.length > 2 && (
                        <span className="text-gray-400 dark:text-gray-500">
                          +{selectedAgents.length - 2} more
                        </span>
                      )}
                    </span>
                  </>
                )}
              </div>
              </div>
            </div>

            {/* Right side - Panel toggle buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Agents Button */}
              <button
                onClick={() => {
                  setShowAgentPanel(!showAgentPanel);
                  if (!showAgentPanel) {
                    setShowInsightsPanel(false);
                    setShowTasksPanel(false);
                  }
                }}
                disabled={isStreaming}
                className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                  isStreaming
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : showAgentPanel
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600'
                    : selectedAgents.length > 0
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
                title="Select agents"
              >
                <Bot className="w-4 h-4" />
                <span className="font-medium hidden sm:inline">Agents</span>
                {selectedAgents.length > 0 && (
                  <span className="bg-blue-500 text-white text-xs min-w-[1.5rem] px-2 py-0.5 rounded-full text-center">
                    {selectedAgents.length}
                  </span>
                )}
              </button>

              {/* Insights Button */}
              {showInsights && (
                <button
                  onClick={() => {
                    const willOpen = !showInsightsPanel;
                    setShowInsightsPanel(willOpen);
                    if (willOpen) {
                      setShowAgentPanel(false);
                      setShowTasksPanel(false);
                      // Load insights when panel opens
                      loadInsights(null, 0, false);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                    showInsightsPanel
                      ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  title="View insights and memories"
                >
                  <Brain className="w-4 h-4" />
                  <span className="font-medium hidden sm:inline">Insights</span>
                  {insightStats && insightStats.total > 0 && (
                    <span className="bg-purple-500 text-white text-xs min-w-[1.5rem] px-2 py-0.5 rounded-full text-center">
                      {insightStats.total}
                    </span>
                  )}
                </button>
              )}

              {/* Tasks Button (placeholder for future) */}
              <button
                onClick={() => {
                  setShowTasksPanel(!showTasksPanel);
                  if (!showTasksPanel) {
                    setShowAgentPanel(false);
                    setShowInsightsPanel(false);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
                  showTasksPanel
                    ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
                title="View and manage tasks"
              >
                <ListTodo className="w-4 h-4" />
                <span className="font-medium hidden sm:inline">Tasks</span>
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 dark:text-gray-400">Loading messages...</div>
            </div>
          ) : (
            <MessageList
              messages={messages}
              streamingContent={streamingContent}
              streamingAgentName={streamingAgentName}
              streamingThoughts={thoughts}
              isLoading={isStreaming}
              onDeleteMessage={handleDeleteMessage}
              onRetryMessage={handleRetryMessage}
            />
          )}
        </div>

        {/* Message Input */}
        <MessageInput
          onSend={handleSendMessage}
          onStop={handleStopStreaming}
          disabled={isStreaming}
          isStreaming={isStreaming}
          conversationId={currentConversation?.id}
          onEnsureConversation={ensureConversation}
        />
      </div>

      {/* Insights Panel */}
      {showInsights && showInsightsPanel && (
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Insights Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Insights</h3>
              <button
                onClick={() => setShowInsightsPanel(false)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Insight action buttons */}
            {currentConversation && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handleForceInsight}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                  title="Manually add an insight"
                >
                  <Sparkles className="w-4 h-4" />
                  Add
                </button>
                <button
                  onClick={handleGenerateInsights}
                  disabled={isLoadingInsights}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50"
                >
                  <Brain className="w-4 h-4" />
                  Generate
                </button>
              </div>
            )}

            {/* Stats */}
            {insightStats && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {insightStats.total} insights
                  </span>
                  {insightCategoryFilter && (
                    <button
                      onClick={() => handleCategoryFilter(null)}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                {/* Category filter buttons */}
                <div className="flex flex-wrap gap-1">
                  {Object.entries(insightStats.by_category || {}).map(([category, count]) => (
                    <button
                      key={category}
                      onClick={() => handleCategoryFilter(insightCategoryFilter === category ? null : category)}
                      className={`text-xs px-2 py-1 rounded-full transition-colors ${
                        insightCategoryFilter === category
                          ? category === 'preference'
                            ? 'bg-blue-500 text-white'
                            : category === 'fact'
                            ? 'bg-green-500 text-white'
                            : category === 'goal'
                            ? 'bg-purple-500 text-white'
                            : category === 'context'
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-500 text-white'
                          : category === 'preference'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                          : category === 'fact'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                          : category === 'goal'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800'
                          : category === 'context'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                      }`}
                    >
                      {category} ({count})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
            <div className="flex gap-2">
              <input
                type="text"
                value={insightSearchQuery}
                onChange={(e) => setInsightSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchInsights();
                  if (e.key === 'Escape') {
                    setInsightSearchQuery('');
                    loadInsights(insightCategoryFilter, 0, false);
                  }
                }}
                placeholder="Search insights..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={handleSearchInsights}
                disabled={isLoadingInsights}
                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Insights List */}
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-3"
            onScroll={(e) => {
              const target = e.target as HTMLDivElement;
              // Load more when scrolled near bottom
              if (target.scrollHeight - target.scrollTop - target.clientHeight < 100) {
                loadMoreInsights();
              }
            }}
          >
            {insights.length === 0 && !isLoadingInsights ? (
              <div className="text-center text-gray-500 dark:text-gray-400">
                <Brain className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm">No insights yet</p>
                <p className="text-xs mt-1">Generate insights from conversations</p>
              </div>
            ) : (
              <>
                {insights.map((result, index) => (
                  <div
                    key={result.insight?.id || index}
                    onClick={() => handleInsightClick(result)}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryFilter(result.insight?.category || 'other');
                        }}
                        className={`text-xs px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 ${
                          result.insight?.category === 'preference'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : result.insight?.category === 'fact'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : result.insight?.category === 'goal'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                            : result.insight?.category === 'context'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {result.insight?.category || 'other'}
                      </button>
                      {result.score < 1 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {(result.score * 100).toFixed(0)}% match
                        </span>
                      )}
                    </div>
                    {/* Markdown content with word wrap */}
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-gray-900 dark:text-white break-words overflow-hidden">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Ensure links wrap properly
                          a: ({ children, href }) => (
                            <a 
                              href={href} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-purple-600 dark:text-purple-400 hover:underline break-all"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {children}
                            </a>
                          ),
                          // Ensure paragraphs don't have excessive margins
                          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        }}
                      >
                        {result.insight?.content || ''}
                      </ReactMarkdown>
                    </div>
                    {result.insight?.createdAt && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        {new Date(result.insight.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
                {isLoadingInsights && (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-2">
                    Loading...
                  </div>
                )}
                {hasMoreInsights && !isLoadingInsights && (
                  <button
                    onClick={loadMoreInsights}
                    className="w-full py-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    Load more...
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Insight Edit Modal */}
      {selectedInsight && (
        <InsightEditModal
          insight={selectedInsight}
          onClose={() => setSelectedInsight(null)}
          onSave={handleSaveInsight}
          onDelete={handleDeleteInsight}
        />
      )}

      {/* Agent Selection Panel */}
      {showAgentPanel && (
        <AgentSelectionPanel
          selectedAgents={selectedAgents}
          onAgentsChange={setSelectedAgents}
          availableAgents={availableAgents.filter(a => a.is_active).map(a => ({
            id: a.id,
            name: a.display_name || a.name,
            description: a.description || '',
            enabled: a.is_active,
            capabilities: [], // Could add capabilities from agent definition if available
          }))}
          onClose={() => setShowAgentPanel(false)}
        />
      )}

      {/* Tasks Panel (Placeholder) */}
      {showTasksPanel && (
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Tasks Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tasks</h3>
              <button
                onClick={() => setShowTasksPanel(false)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage background tasks and scheduled operations.
            </p>
          </div>

          {/* Tasks Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <ListTodo className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium">Coming Soon</p>
              <p className="text-xs mt-2">
                Agent tasks feature is under development. Soon you&apos;ll be able to:
              </p>
              <ul className="text-xs mt-3 space-y-1 text-left max-w-[200px] mx-auto">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  Schedule recurring tasks
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  Create background research jobs
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  Set up automated reports
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

