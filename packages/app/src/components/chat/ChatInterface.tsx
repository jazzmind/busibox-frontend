'use client';
/**
 * ChatInterface - Core Chat Component
 * 
 * The primary chat component for all Busibox apps. Supports:
 * - Agentic streaming with real-time thoughts, tool cards, and prompts
 * - Standard streaming and non-streaming fallback modes
 * - Message parts architecture (text, thinking, tool calls, prompts)
 * - Quick replies and bracket-based suggested actions
 * - Progressive disclosure for agent thinking
 * - Optional file attachments
 * - Single conversation UI (no sidebar)
 * 
 * For the portal-level chat with conversation sidebar, insights, and
 * multi-agent selection, see ChatContainer.
 * 
 * Usage:
 * ```typescript
 * <ChatInterface
 *   token="bearer-token"
 *   enableWebSearch={true}
 *   enableDocSearch={false}
 *   allowAttachments={false}
 *   placeholder="Ask me anything..."
 *   useAgenticStreaming={true}
 * />
 * ```
 */


import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, Loader2, Paperclip, Plus, Trash2, Volume2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { MessageList } from './MessageList';
import type { ThoughtEvent } from './ThinkingToggle';
import { stripThinkTags } from './chat-utils';
import { sendChatMessage, streamChatMessageAgentic, getConversationHistory } from '../../lib/agent/chat-client';
import { createAccumulator, processStreamEvent } from '../../lib/agent/stream-event-processor';
import type { ChatMessageRequest, Message, Attachment, MessagePart } from '../../types/chat';

type ExecutionEvent = ThoughtEvent;


export interface ChatInterfaceProps {
  /** Authorization token for agent API */
  token: string;
  /** Agent API base URL (optional) */
  agentUrl?: string;
  /** Specific agent ID to use for this chat (optional) */
  agentId?: string;
  /** Enable web search tool (default: false) */
  enableWebSearch?: boolean;
  /** Enable document search tool (default: false) */
  enableDocSearch?: boolean;
  /** Allow file attachments (default: false) */
  allowAttachments?: boolean;
  /** Input placeholder text */
  placeholder?: string;
  /** Welcome message to display */
  welcomeMessage?: string;
  /** Model to use ('auto', 'chat', 'research', 'frontier') */
  model?: string;
  /** @deprecated Standard streaming is removed; agentic streaming is always used */
  useStreaming?: boolean;
  /** Use agentic streaming with real-time thoughts (default: true) */
  useAgenticStreaming?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Callback when message is sent */
  onMessageSent?: (message: string) => void;
  /** Callback when response is received */
  onResponseReceived?: (response: string) => void;
  /** Initial conversation ID to load (optional) */
  initialConversationId?: string;
  /** Application context metadata passed to agent tools (e.g. { projectId: "abc" }) */
  metadata?: Record<string, any>;
  /** Callback when a conversation is deleted */
  onConversationDeleted?: (conversationId: string) => void;
}

interface DisplayMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  createdAt?: Date;
  agentName?: string;
  thoughts?: ExecutionEvent[];
  parts?: MessagePart[];
}

export function ChatInterface({
  token,
  agentUrl,
  agentId,
  enableWebSearch = false,
  enableDocSearch = false,
  allowAttachments = false,
  placeholder = 'Type your message...',
  welcomeMessage,
  model = 'auto',
  useStreaming: _useStreaming = true,
  useAgenticStreaming = true,
  className = '',
  onMessageSent,
  onResponseReceived,
  initialConversationId,
  metadata,
  onConversationDeleted,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [thoughts, setThoughts] = useState<ExecutionEvent[]>([]);
  const [interimMessages, setInterimMessages] = useState<string[]>([]);
  const [streamingAgentName, setStreamingAgentName] = useState<string | undefined>(undefined);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showVoiceComingSoon, setShowVoiceComingSoon] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [promptActive, setPromptActive] = useState(false);
  const [streamingParts, setStreamingParts] = useState<MessagePart[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tokenRef = useRef(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const loadConversationHistory = useCallback(async (convId: string) => {
    setLoadingHistory(true);
    try {
      const history = await getConversationHistory(convId, { token: tokenRef.current, agentUrl });
      const displayMessages: DisplayMessage[] = history.map(msg => {
        const raw = msg as any;
        const thoughts = raw.routing_decision?.thoughts || raw.thoughts;
        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          createdAt: new Date(raw.created_at || raw.createdAt || Date.now()),
          thoughts: thoughts?.length > 0 ? thoughts : undefined,
        };
      });
      setMessages(displayMessages);
      setConversationId(convId);
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      toast.error('Failed to load conversation history');
    } finally {
      setLoadingHistory(false);
    }
  }, [agentUrl]);

  // Load conversation history when initialConversationId changes (not on token refresh)
  useEffect(() => {
    if (initialConversationId && tokenRef.current) {
      loadConversationHistory(initialConversationId);
    }
  }, [initialConversationId, loadConversationHistory]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // For simplicity, just store file info
    // In a real implementation, you'd upload to data API first
    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
      size: file.size,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
    toast.success(`${files.length} file(s) attached`);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent | null, overrideMessage?: string) => {
    e?.preventDefault();
    const messageText = overrideMessage ?? input.trim();
    if (!messageText) return;

    // Abort any in-flight stream so the new message can proceed
    if (isLoading && abortController) {
      abortController.abort();
    }

    const userMessage = messageText;
    setInput('');
    setPromptActive(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Add user message to display
    const userDisplayMessage: DisplayMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userDisplayMessage]);

    // Callback
    onMessageSent?.(userMessage);

    setIsLoading(true);
    setQuickReplies([]);
    
    // Create abort controller for cancellation
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const request: ChatMessageRequest = {
        message: userMessage,
        conversation_id: conversationId,
        model,
        enable_web_search: enableWebSearch,
        enable_doc_search: enableDocSearch,
        attachments: attachments.length > 0 ? attachments : undefined,
        selected_agents: agentId ? [agentId] : undefined,
        metadata: metadata || undefined,
      };

      if (useAgenticStreaming) {
        // Agentic streaming with real-time thoughts and message parts
        setStreamingContent('');
        setThoughts([]);
        setInterimMessages([]);
        setStreamingAgentName(undefined);
        setStreamingParts([]);
        const accumulated = createAccumulator();
        let hasAddedMessage = false;

        for await (const event of streamChatMessageAgentic(request, { token: tokenRef.current, agentUrl, signal: controller.signal })) {
          const parsed = event.data;

          // message_complete and error have ChatInterface-specific side effects
          // (creating DisplayMessages, toasts) so they're handled inline.
          if (event.type === 'message_complete') {
            if (!hasAddedMessage) {
              setConversationId(parsed.conversation_id);

              const cleanedContent = stripThinkTags(accumulated.fullContent);
              if (cleanedContent) {
                const finalParts: MessagePart[] = [
                  ...accumulated.parts,
                  { type: 'text', content: cleanedContent },
                ];
                const assistantMessage: DisplayMessage = {
                  id: `asst-${Date.now()}`,
                  role: 'assistant',
                  content: cleanedContent,
                  timestamp: new Date(),
                  thoughts: accumulated.thoughts.length > 0 ? accumulated.thoughts : undefined,
                  agentName: accumulated.agentName,
                  parts: finalParts,
                };
                setMessages((prev) => [...prev, assistantMessage]);
                hasAddedMessage = true;
              }

              setStreamingContent('');
              setThoughts([]);
              setInterimMessages([]);
              setStreamingAgentName(undefined);
              setStreamingParts([]);
              setIsLoading(false);

              if (cleanedContent) {
                onResponseReceived?.(cleanedContent);
              }
            }
            continue;
          }

          if (event.type === 'error') {
            const errorMessage = parsed?.message || parsed?.error || 'An error occurred';
            const errorSource = parsed?.source || parsed?.data?.source || '';
            const isToolError = errorSource && !errorSource.includes('agent') && !errorSource.includes('dispatcher');

            if (isToolError) {
              accumulated.thoughts = [...accumulated.thoughts, {
                type: 'error' as const,
                source: errorSource,
                message: `Tool error (${errorSource}): ${errorMessage}`,
                data: parsed,
                timestamp: new Date(),
              }];
              setThoughts(accumulated.thoughts);

              const errIdx = accumulated.pendingTools.get(errorSource);
              if (errIdx !== undefined && accumulated.parts[errIdx]?.type === 'tool_call') {
                const existing = accumulated.parts[errIdx] as Extract<MessagePart, { type: 'tool_call' }>;
                accumulated.parts = [...accumulated.parts];
                accumulated.parts[errIdx] = { ...existing, status: 'error', error: errorMessage, completedAt: new Date() };
                accumulated.pendingTools.delete(errorSource);
                setStreamingParts(accumulated.parts);
              }
            } else {
              toast.error(errorMessage);

              if (!hasAddedMessage) {
                const errorContent = accumulated.fullContent.trim()
                  ? `${accumulated.fullContent}\n\n**Error:** ${errorMessage}`
                  : `**Error:** ${errorMessage}`;
                const errorAssistantMessage: DisplayMessage = {
                  id: `asst-err-${Date.now()}`,
                  role: 'assistant',
                  content: errorContent,
                  timestamp: new Date(),
                  thoughts: accumulated.thoughts.length > 0 ? accumulated.thoughts : undefined,
                  agentName: accumulated.agentName,
                  parts: accumulated.parts,
                };
                setMessages((prev) => [...prev, errorAssistantMessage]);
                hasAddedMessage = true;
              }

              setStreamingContent('');
              setThoughts([]);
              setInterimMessages([]);
              setStreamingAgentName(undefined);
              setStreamingParts([]);
            }
            continue;
          }

          // All other events go through the shared processor
          const result = processStreamEvent(event.type, parsed, accumulated);

          if (result.conversationId && !result.titleUpdate) {
            setConversationId(result.conversationId);
          }
          if (accumulated.agentName) {
            setStreamingAgentName(accumulated.agentName);
          }
          if (result.content !== undefined) {
            setStreamingContent(result.content);
          }
          if (result.thoughts) {
            setThoughts(result.thoughts);
          }
          if (result.parts) {
            setStreamingParts(result.parts);
          }
          if (result.interimMessages) {
            setInterimMessages(result.interimMessages);
          }
          if (result.quickReplies) {
            setQuickReplies(result.quickReplies);
          }
          if (result.promptActive !== undefined) {
            setPromptActive(result.promptActive);
          }

          // prompt event: finalize accumulated content as a completed message
          if (event.type === 'prompt' && result.promptActive) {
            const cleanedSoFar = stripThinkTags(accumulated.fullContent);
            if (cleanedSoFar && !hasAddedMessage) {
              const assistantMessage: DisplayMessage = {
                id: `asst-prompt-${Date.now()}`,
                role: 'assistant',
                content: cleanedSoFar,
                timestamp: new Date(),
                thoughts: accumulated.thoughts.length > 0 ? accumulated.thoughts : undefined,
                agentName: accumulated.agentName,
                parts: accumulated.parts,
              };
              setMessages((prev) => [...prev, assistantMessage]);
              hasAddedMessage = true;
            }
            setStreamingContent('');
            setThoughts([]);
            setInterimMessages([]);
            setStreamingParts([]);
          }
        }
      } else {
        // Non-streaming fallback
        const response = await sendChatMessage(request, { token: tokenRef.current, agentUrl });

        setConversationId(response.conversation_id);

        const assistantMessage: DisplayMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        onResponseReceived?.(response.content);
      }

      // Clear attachments after successful send
      setAttachments([]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was cancelled - add partial response if any
        if (streamingContent) {
          const partialMessage: DisplayMessage = {
            id: `asst-partial-${Date.now()}`,
            role: 'assistant',
            content: streamingContent + '\n\n*[Response interrupted]*',
            timestamp: new Date(),
            thoughts: thoughts.length > 0 ? thoughts : undefined,
          };
          setMessages((prev) => [...prev, partialMessage]);
        }
        toast('Response cancelled', { icon: '⏹️' });
      } else {
        console.error('Chat error:', error);
        toast.error(error.message || 'Failed to send message');

        // Add error message
        const errorMessage: DisplayMessage = {
          id: `asst-err-${Date.now()}`,
          role: 'assistant',
          content: `❌ Error: ${error.message || 'Failed to send message'}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      setThoughts([]);
      setInterimMessages([]);
      setAbortController(null);
      setPromptActive(false);
      setStreamingParts([]);
    }
  };
  
  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const handleQuickReply = (reply: string) => {
    setQuickReplies([]);
    setPromptActive(false);
    // Abort lingering stream before sending the reply as a new message
    if (isLoading && abortController) {
      abortController.abort();
    }
    // Small delay to let the abort settle before we fire a new request
    setTimeout(() => handleSubmit(null, reply), 50);
  };

  const handleNewChat = () => {
    // Cancel any ongoing request
    if (abortController) {
      abortController.abort();
    }
    
    // Reset all state
    setMessages([]);
    setConversationId(undefined);
    setStreamingContent('');
    setThoughts([]);
    setInterimMessages([]);
    setIsLoading(false);
    setAttachments([]);
    setStreamingAgentName(undefined);
    setQuickReplies([]);
    setPromptActive(false);
    setInput('');
    
    toast.success('Started new chat');
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!conversationId) {
      // No conversation - just remove from local state
      setMessages(prev => prev.filter(m => m.id !== messageId));
      return;
    }

    try {
      const response = await fetch(`${agentUrl || ''}/chat/${conversationId}/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversationId) {
      // No conversation to delete, just clear local messages
      handleNewChat();
      return;
    }

    if (!confirm('Are you sure you want to delete this conversation?')) return;

    const deletedId = conversationId;

    try {
      const response = await fetch(`${agentUrl || ''}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      // Clear local state
      setMessages([]);
      setConversationId(undefined);
      setStreamingContent('');
      setThoughts([]);
      setInterimMessages([]);
      setIsLoading(false);
      setAttachments([]);
      setStreamingAgentName(undefined);
      setInput('');

      // Notify parent about the deletion
      onConversationDeleted?.(deletedId);

      toast.success('Conversation deleted');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('Failed to delete conversation');
    }
  };

  const handleRetryMessage = async (messageContent: string, attachmentIds?: string[]) => {
    // Delete the last assistant message if it exists
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      setMessages(prev => prev.slice(0, -1));
    }
    
    // Delete the user message that we're retrying
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      setMessages(prev => prev.slice(0, -1));
    }
    
    // Re-send the message by setting input and triggering submit
    setInput(messageContent);
    
    // Small delay to ensure state is updated, then trigger submit
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.requestSubmit();
      }
    }, 50);
  };

  return (
    <div className={`flex flex-col h-full min-h-0 bg-white dark:bg-gray-900 ${className}`}>
      {/* Header - Compact */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowVoiceComingSoon(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors"
            title="Voice mode (coming soon)"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Voice</span>
          </button>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors"
            title="Start new chat"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
          {conversationId && (
            <button
              onClick={handleDeleteConversation}
              className="flex items-center gap-1.5 p-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete this conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages - scrollable area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-900">
        {/* Loading history indicator */}
        {loadingHistory && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading conversation...</span>
          </div>
        )}

        {/* Use MessageList for rendering messages - provides consistent markdown rendering */}
        {!loadingHistory && (
          <MessageList
            messages={(() => {
              // Build messages array, optionally including welcome message
              const displayMessages = messages.map((m, idx) => ({
                id: m.id || `msg-${idx}`,
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content,
                createdAt: m.createdAt || new Date(),
                agentName: m.agentName,
                thoughts: m.thoughts,
                parts: m.parts,
              }));
              
              // Add welcome message as first assistant message if no messages yet
              if (welcomeMessage && displayMessages.length === 0) {
                displayMessages.unshift({
                  id: 'welcome',
                  role: 'assistant' as const,
                  content: welcomeMessage,
                  createdAt: new Date(),
                  agentName: undefined,
                  thoughts: undefined,
                  parts: undefined,
                });
              }
              
              return displayMessages;
            })()}
            streamingContent={streamingContent || undefined}
            streamingAgentName={streamingAgentName}
            streamingThoughts={thoughts}
            streamingParts={streamingParts}
            isLoading={isLoading}
            onDeleteMessage={handleDeleteMessage}
            onRetryMessage={handleRetryMessage}
            onSuggestedAction={(action) => handleSubmit(null, action)}
          />
        )}

        {/* empty */}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <span className="text-sm text-gray-700 dark:text-gray-200">{attachment.name}</span>
                <button
                  onClick={() => handleRemoveAttachment(index)}
                  className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick-reply buttons -- visible whenever options exist (including mid-stream prompt) */}
      {quickReplies.length > 0 && (
        <div className="flex-shrink-0 px-3 pt-2 pb-1 flex flex-wrap gap-2 justify-center border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => handleQuickReply(reply)}
              className="px-4 py-1.5 text-sm font-medium rounded-full border border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input - pinned to bottom */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex gap-2 items-end">
          {allowAttachments && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                title="Attach files"
              >
                <Paperclip className="w-5 h-5" />
              </button>
            </>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (input.trim()) {
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }
            }}
            placeholder={promptActive ? 'Type your reply...' : placeholder}
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
            style={{ minHeight: '40px', maxHeight: '200px' }}
            disabled={false}
          />
          {isLoading && !promptActive && (
            <button
              type="button"
              onClick={handleCancel}
              className="bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium flex-shrink-0"
              title="Cancel"
            >
              <span className="w-5 h-5 flex items-center justify-center">⏹</span>
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>

      {showVoiceComingSoon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Voice Mode</h4>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Voice mode is coming soon. Chat remains text-only for now.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVoiceComingSoon(false)}
                className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close voice mode modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowVoiceComingSoon(false)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

