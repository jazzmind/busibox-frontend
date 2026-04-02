'use client';
/**
 * @deprecated Use ChatInterface from './ChatInterface' instead.
 * This legacy component uses raw streaming without message parts or
 * tool cards. It will be removed in a future release.
 * 
 * Full Chat Interface Component
 * 
 * A comprehensive chat interface with:
 * - Conversation history sidebar
 * - Model selection
 * - Web/document search toggles
 * - File attachments
 * - Insights viewing and management
 * - Streaming responses
 * - Message history
 * 
 * Perfect for full-featured chat applications.
 * 
 * Usage:
 * ```typescript
 * <FullChatInterface
 *   token="bearer-token"
 *   showInsights={true}
 *   allowConversationManagement={true}
 * />
 * ```
 */


import { useState, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, Search, Brain, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ThinkingSection, ThoughtEvent } from './ThinkingSection';
import { ModelSelector } from './ModelSelector';
import { ToolSelector, Tool } from './ToolSelector';
import { AgentSelector, Agent } from './AgentSelector';
import { LibrarySelector, Library } from './LibrarySelector';
import {
  getConversations,
  createConversation,
  deleteConversation,
  updateConversation,
  getConversationHistory,
  sendChatMessage,
  streamChatMessage,
  searchInsights,
  generateInsights,
  getInsightStats,
  insertInsights,
  deleteConversationInsights,
} from '../../lib/agent/chat-client';
import type {
  Conversation,
  Message,
  MessageAttachment,
  ChatInsight,
  InsightSearchResult,
  ChatMessageRequest,
} from '../../types/chat';
import { useIsMobile } from '../../lib/hooks/useIsMobile';

// Use ThoughtEvent from shared component
type ExecutionEvent = ThoughtEvent;

export interface FullChatInterfaceProps {
  /** Authorization token for agent API */
  token: string;
  /** Agent API base URL (optional) */
  agentUrl?: string;
  /** Show insights panel (default: true) */
  showInsights?: boolean;
  /** Allow conversation management (create/delete) */
  allowConversationManagement?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Initial conversation ID to load */
  initialConversationId?: string;
  /** Available tools for selection */
  availableTools?: Tool[];
  /** Available agents for selection */
  availableAgents?: Agent[];
  /** Available libraries for selection */
  availableLibraries?: Library[];
}

export function FullChatInterface({
  token,
  agentUrl,
  showInsights = true,
  allowConversationManagement = true,
  className = '',
  initialConversationId,
  availableTools,
  availableAgents,
  availableLibraries,
}: FullChatInterfaceProps) {
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Chat state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [executionEvents, setExecutionEvents] = useState<ExecutionEvent[]>([]);
  const [streamingAgentName, setStreamingAgentName] = useState<string | undefined>();

  // Selection state
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);

  // Insights state
  const [showInsightsPanel, setShowInsightsPanel] = useState(false);
  const [insights, setInsights] = useState<InsightSearchResult[]>([]);
  const [insightStats, setInsightStats] = useState<any>(null);
  const [insightSearchQuery, setInsightSearchQuery] = useState('');
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Load initial conversation if provided
  useEffect(() => {
    if (initialConversationId && conversations.length > 0) {
      const conv = conversations.find((c) => c.id === initialConversationId);
      if (conv) {
        handleSelectConversation(conv);
      }
    }
  }, [initialConversationId, conversations]);

  // Load insight stats when insights panel is opened
  useEffect(() => {
    if (showInsightsPanel && showInsights) {
      loadInsightStats();
    }
  }, [showInsightsPanel]);

  const loadConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const convs = await getConversations({ token, agentUrl, limit: 50 });
      setConversations(convs);

      // Auto-select first conversation if none selected
      if (!currentConversation && convs.length > 0) {
        await handleSelectConversation(convs[0]);
      }
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setCurrentConversation(conversation);
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
    setIsLoadingMessages(true);

    try {
      const msgs = await getConversationHistory(conversation.id, { token, agentUrl, limit: 100 });
      setMessages(msgs);
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleCreateConversation = async () => {
    try {
      const newConv = await createConversation('New Conversation', { token, agentUrl });
      setConversations((prev) => [newConv, ...prev]);
      await handleSelectConversation(newConv);
      if (isMobile) {
        setMobileSidebarOpen(false);
      }
      toast.success('New conversation created');
    } catch (error: any) {
      console.error('Failed to create conversation:', error);
      toast.error('Failed to create conversation');
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await deleteConversation(conversationId, { token, agentUrl });
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));

      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
        setMessages([]);

        // Select first remaining conversation
        const remaining = conversations.filter((c) => c.id !== conversationId);
        if (remaining.length > 0) {
          await handleSelectConversation(remaining[0]);
        }
      }

      toast.success('Conversation deleted');
    } catch (error: any) {
      console.error('Failed to delete conversation:', error);
      toast.error('Failed to delete conversation');
    }
  };

  const handleSendMessage = async (
    content: string,
    attachmentIds?: string[],
    attachmentMeta?: MessageAttachment[],
    model?: string
  ) => {
    if (!content.trim()) return;

    // Create conversation if none exists
    let convId = currentConversation?.id;
    if (!convId) {
      const newConv = await createConversation('New Conversation', { token, agentUrl });
      setConversations((prev) => [newConv, ...prev]);
      setCurrentConversation(newConv);
      convId = newConv.id;
    }

    // Add user message optimistically
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: convId,
      role: 'user',
      content,
      attachments: attachmentMeta,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    setIsStreaming(true);
    setStreamingContent('');
    setExecutionEvents([]);
    setStreamingAgentName(undefined);

    try {
      // Determine if web/doc search is enabled based on selected tools
      const hasWebSearch = selectedTools.includes('web_search');
      const hasDocSearch = selectedTools.includes('doc_search');

      const request: ChatMessageRequest = {
        message: content,
        conversation_id: convId,
        model: model || 'auto',
        attachment_ids: attachmentIds && attachmentIds.length > 0 ? attachmentIds : undefined,
        enable_web_search: hasWebSearch,
        enable_doc_search: hasDocSearch,
        selected_tools: selectedTools.length > 0 ? selectedTools : undefined,
        selected_agents: selectedAgents.length > 0 ? selectedAgents : undefined,
        selected_libraries: selectedLibraries.length > 0 ? selectedLibraries : undefined,
      };

      let fullContent = '';
      let assistantMessageId = '';
      let collectedEvents: ExecutionEvent[] = [];
      let routingDecision: any = null;
      let toolResults: any[] = [];
      let agentResults: any[] = [];

      for await (const event of streamChatMessage(request, { token, agentUrl })) {
        const newEvent: ExecutionEvent = {
          type: event.type,
          message: event.data?.message,
          data: event.data,
          timestamp: new Date(),
        };

        // Handle different event types
        switch (event.type) {
          case 'planning':
          case 'tool_start':
          case 'agent_start':
          case 'agent_response_start':
          case 'synthesis_start':
            collectedEvents = [...collectedEvents, newEvent];
            setExecutionEvents(collectedEvents);
            break;

          case 'tool_result':
            collectedEvents = [...collectedEvents, newEvent];
            setExecutionEvents(collectedEvents);
            toolResults.push(event.data);
            break;

          case 'agent_result':
            collectedEvents = [...collectedEvents, newEvent];
            setExecutionEvents(collectedEvents);
            agentResults.push(event.data);
            // Update agent name for avatar
            if (event.data?.agent_id || event.data?.agent_name) {
              setStreamingAgentName(event.data.agent_name || event.data.agent_id);
            }
            break;

          case 'routing_decision':
            routingDecision = event.data;
            collectedEvents = [...collectedEvents, newEvent];
            setExecutionEvents(collectedEvents);
            break;

          case 'model_selected':
            // Model selection info
            collectedEvents = [...collectedEvents, newEvent];
            setExecutionEvents(collectedEvents);
            break;

          case 'content_chunk':
            fullContent += event.data.chunk;
            setStreamingContent(fullContent);
            // Track which source is generating content
            if (event.data.source) {
              setStreamingAgentName(event.data.source);
            }
            break;

          case 'execution_complete':
            collectedEvents = [...collectedEvents, newEvent];
            setExecutionEvents(collectedEvents);
            break;

          case 'message_complete':
            assistantMessageId = event.data.message_id;

            // Build debug info for the message
            const debugInfo = {
              routingDecision,
              toolResults,
              agentResults,
              events: collectedEvents,
            };

            // Embed debug info in content for the MessageList to parse
            const contentWithDebug = `<!-- ROUTING_DEBUG:${JSON.stringify({
              dualModel: false,
              primaryModel: event.data.model,
              toolsUsed: toolResults.length > 0,
              toolResults: toolResults.map(tr => ({
                toolName: tr.tool_name || tr.tool,
                success: tr.success !== false,
                resultPreview: tr.output?.substring?.(0, 200) || JSON.stringify(tr).substring(0, 200),
              })),
              routingPath: collectedEvents.map(e => `${e.type}: ${e.message || ''}`),
            })}:END_ROUTING -->\n${fullContent}`;

            // Replace temp user message and add assistant message
            const realUserMessage: Message = {
              id: event.data.message_id + '-user',
              conversationId: convId!,
              role: 'user',
              content,
              createdAt: new Date(),
            };

            const assistantMessage: Message = {
              id: assistantMessageId,
              conversationId: convId!,
              role: 'assistant',
              content: contentWithDebug,
              model: event.data.model,
              agentName: streamingAgentName,
              createdAt: new Date(),
            };

            setMessages((prev) => {
              const withoutTemp = prev.filter((m) => m.id !== tempUserMessage.id);
              return [...withoutTemp, realUserMessage, assistantMessage];
            });

            setStreamingContent('');
            setExecutionEvents([]);

            // Reload conversations to update message count
            loadConversations();
            break;

          case 'error':
            toast.error(event.data?.error || 'An error occurred');
            break;
        }
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error(error.message || 'Failed to send message');

      // Remove temp message
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setExecutionEvents([]);
      setStreamingAgentName(undefined);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    // Note: Agent API doesn't support individual message deletion
    // Just remove from local state for UI purposes
    setMessages(prev => prev.filter(m => m.id !== messageId));
    toast.success('Message hidden');
  };

  const handleRetryMessage = async (messageContent: string, attachmentIds?: string[]) => {
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
  };

  const handleSearchInsights = async () => {
    if (!insightSearchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setIsLoadingInsights(true);
    try {
      const results = await searchInsights(insightSearchQuery, {
        token,
        agentUrl,
        limit: 20,
        conversationId: currentConversation?.id,
      });
      setInsights(results);

      if (results.length === 0) {
        toast('No insights found');
      }
    } catch (error: any) {
      console.error('Failed to search insights:', error);
      toast.error('Failed to search insights');
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (!currentConversation) {
      toast.error('No conversation selected');
      return;
    }

    setIsLoadingInsights(true);
    try {
      const result = await generateInsights(currentConversation.id, { token, agentUrl });
      toast.success(`Generated ${result.count} insights`);
      await loadInsightStats();
    } catch (error: any) {
      console.error('Failed to generate insights:', error);
      toast.error('Failed to generate insights');
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const handleDeleteConversationInsights = async () => {
    if (!currentConversation) return;

    if (!confirm('Delete all insights for this conversation?')) return;

    try {
      const result = await deleteConversationInsights(currentConversation.id, { token, agentUrl });
      toast.success(`Deleted ${result.count} insights`);
      setInsights([]);
      await loadInsightStats();
    } catch (error: any) {
      console.error('Failed to delete insights:', error);
      toast.error('Failed to delete insights');
    }
  };

  const loadInsightStats = async () => {
    try {
      const stats = await getInsightStats({ token, agentUrl });
      setInsightStats(stats);
    } catch (error: any) {
      console.error('Failed to load insight stats:', error);
    }
  };

  const conversationSidebar = (
    <div className="w-64 h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
          {showInsights && (
            <button
              onClick={() => setShowInsightsPanel(!showInsightsPanel)}
              className={`p-2 rounded-lg transition-colors ${
                showInsightsPanel
                  ? 'bg-purple-100 text-purple-600'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="Toggle insights panel"
            >
              <Brain className="w-5 h-5" />
            </button>
          )}
        </div>
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
        {isLoadingConversations ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                  currentConversation?.id === conv.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleSelectConversation(conv)}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {conv.title || 'Untitled'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {conv.messageCount} messages
                  </p>
                </div>
                {allowConversationManagement && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-all"
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
    <div className={`flex h-full bg-gray-50 ${className}`}>
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
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              {isMobile && (
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="md:hidden p-2 rounded-lg border border-gray-300 text-gray-600"
                  title="Open conversations"
                  aria-label="Open conversations"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 12h18M3 18h18" />
                  </svg>
                </button>
              )}
              <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {currentConversation?.title || 'Select a conversation'}
              </h3>
              {currentConversation && (
                <p className="text-sm text-gray-500 hidden sm:block">
                  {messages.length} messages
                </p>
              )}
              </div>
            </div>
            {currentConversation && showInsights && (
              <button
                onClick={handleGenerateInsights}
                disabled={isLoadingInsights}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
              >
                <Brain className="w-4 h-4" />
                Generate Insights
              </button>
            )}
          </div>

          {/* Tool/Agent/Library Selectors */}
          {currentConversation && (
            <div className="flex items-center gap-2 flex-wrap">
              <ToolSelector
                selectedTools={selectedTools}
                onToolsChange={setSelectedTools}
                disabled={isStreaming}
                availableTools={availableTools}
              />
              <AgentSelector
                selectedAgents={selectedAgents}
                onAgentsChange={setSelectedAgents}
                disabled={isStreaming}
                availableAgents={availableAgents}
              />
              <LibrarySelector
                selectedLibraries={selectedLibraries}
                onLibrariesChange={setSelectedLibraries}
                disabled={isStreaming}
                availableLibraries={availableLibraries}
                documentSearchEnabled={selectedTools.includes('doc_search')}
              />
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading messages...</div>
            </div>
          ) : (
            <>
              {/* Show thinking section during streaming */}
              {isStreaming && executionEvents.length > 0 && (
                <div className="px-6 pt-4">
                  <ThinkingSection 
                    thoughts={executionEvents} 
                    isActive={isStreaming}
                    defaultCollapsed={!!streamingContent}
                  />
                </div>
              )}
              <MessageList
                messages={messages}
                streamingContent={streamingContent}
                streamingAgentName={streamingAgentName}
                isLoading={isStreaming}
                onDeleteMessage={handleDeleteMessage}
                onRetryMessage={handleRetryMessage}
              />
            </>
          )}
        </div>

        {/* Message Input */}
        <MessageInput
          onSend={handleSendMessage}
          disabled={isStreaming}
          isStreaming={isStreaming}
          conversationId={currentConversation?.id}
        />
      </div>

      {/* Insights Panel */}
      {showInsights && showInsightsPanel && (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          {/* Insights Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Insights</h3>
              <button
                onClick={() => setShowInsightsPanel(false)}
                className="p-1 text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats */}
            {insightStats && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-purple-50 p-2 rounded">
                  <div className="text-2xl font-bold text-purple-700">
                    {insightStats.total}
                  </div>
                  <div className="text-xs text-purple-600">Total Insights</div>
                </div>
                <div className="bg-blue-50 p-2 rounded">
                  <div className="text-2xl font-bold text-blue-700">
                    {Object.keys(insightStats.by_category || {}).length}
                  </div>
                  <div className="text-xs text-blue-600">Categories</div>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="flex gap-2">
              <input
                type="text"
                value={insightSearchQuery}
                onChange={(e) => setInsightSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchInsights()}
                placeholder="Search insights..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoadingInsights ? (
              <div className="text-center text-gray-500">Loading...</div>
            ) : insights.length === 0 ? (
              <div className="text-center text-gray-500">
                <Brain className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No insights yet</p>
                <p className="text-xs mt-1">
                  Search or generate insights from conversations
                </p>
              </div>
            ) : (
              insights.map((result, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        result.insight.category === 'preference'
                          ? 'bg-blue-100 text-blue-700'
                          : result.insight.category === 'fact'
                          ? 'bg-green-100 text-green-700'
                          : result.insight.category === 'goal'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {result.insight.category}
                    </span>
                    <span className="text-xs text-gray-500">
                      {(result.score * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <p className="text-sm text-gray-900">{result.insight.content}</p>
                  {result.insight.source && (
                    <p className="text-xs text-gray-500 mt-1">
                      Source: {result.insight.source}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          {currentConversation && insights.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleDeleteConversationInsights}
                className="w-full px-4 py-2 text-sm text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete Conversation Insights
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

