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


import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, Paperclip, Brain, CheckCircle, AlertCircle, Plus, Trash2, Volume2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { MessageList } from './MessageList';
import { ThinkingToggle, ThoughtEvent } from './ThinkingToggle';
import { StreamingToolCard } from './StreamingToolCard';
import { stripThinkTags, extractThinkContent, preprocessLatex, streamingMarkdownComponents } from './chat-utils';
import { sendChatMessage, streamChatMessage, streamChatMessageAgentic, getConversationHistory } from '../../lib/agent/chat-client';
import type { ChatMessageRequest, Message, Attachment, MessagePart } from '../../types/chat';

type ExecutionEvent = ThoughtEvent;

// Real-time execution status display (legacy, for non-agentic streaming)
function ExecutionStatus({ events, isActive }: { events: ExecutionEvent[]; isActive: boolean }) {
  if (events.length === 0) return null;

  // Only show the last few relevant events
  const relevantEvents = events.filter(e => 
    ['planning', 'tool_start', 'tool_result', 'agent_start', 'agent_result', 'synthesis_start'].includes(e.type)
  ).slice(-4);

  if (relevantEvents.length === 0) return null;

  return (
    <div className="flex gap-3 justify-start mb-4">
      <div className="bg-blue-600 dark:bg-blue-500 rounded-full p-2 h-8 w-8 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="max-w-[80%] rounded-lg p-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <div className="space-y-1.5">
          {relevantEvents.map((event, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              {event.type === 'planning' && (
                <>
                  <Brain className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                  <span className="text-purple-700 dark:text-purple-400">{event.message || 'Analyzing...'}</span>
                </>
              )}
              {event.type === 'tool_start' && (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
                  <span className="text-blue-700 dark:text-blue-400">{event.message || `Running ${event.data?.display_name || event.data?.tool}...`}</span>
                </>
              )}
              {event.type === 'tool_result' && (
                <>
                  {event.data?.success !== false ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  )}
                  <span className={event.data?.success !== false ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                    {event.message || `${event.data?.display_name || event.data?.tool_name} done`}
                  </span>
                </>
              )}
              {event.type === 'agent_start' && (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin flex-shrink-0" />
                  <span className="text-indigo-700 dark:text-indigo-400">{event.message || `Consulting ${event.data?.display_name || event.data?.agent}...`}</span>
                </>
              )}
              {event.type === 'agent_result' && (
                <>
                  {event.data?.success !== false ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  )}
                  <span className={event.data?.success !== false ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                    {event.message || 'Agent responded'}
                  </span>
                </>
              )}
              {event.type === 'synthesis_start' && (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin flex-shrink-0" />
                  <span className="text-purple-700 dark:text-purple-400">{event.message || 'Combining results...'}</span>
                </>
              )}
            </div>
          ))}
          {isActive && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


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
  /** Use streaming responses (default: true) */
  useStreaming?: boolean;
  /** Use agentic streaming with real-time thoughts (default: false) */
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
  useStreaming = true,
  useAgenticStreaming = false,
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
  const [executionEvents, setExecutionEvents] = useState<ExecutionEvent[]>([]);
  const [thoughts, setThoughts] = useState<ExecutionEvent[]>([]);  // For agentic streaming
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Load conversation history when initialConversationId is provided
  useEffect(() => {
    if (initialConversationId && token) {
      loadConversationHistory(initialConversationId);
    }
  }, [initialConversationId, token]);

  const loadConversationHistory = async (convId: string) => {
    setLoadingHistory(true);
    try {
      const history = await getConversationHistory(convId, { token, agentUrl });
      // Convert to DisplayMessage format
      const displayMessages: DisplayMessage[] = history.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        createdAt: new Date((msg as any).created_at || (msg as any).createdAt || Date.now()),
      }));
      setMessages(displayMessages);
      setConversationId(convId);
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      toast.error('Failed to load conversation history');
    } finally {
      setLoadingHistory(false);
    }
  };

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
    // Allow submission when promptActive even if isLoading is still true
    if (!messageText || (isLoading && !promptActive)) return;

    // If we're submitting during a prompt-active state, abort the lingering stream
    if (isLoading && promptActive && abortController) {
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
        let fullContent = '';
        let collectedThoughts: ExecutionEvent[] = [];
        let collectedParts: MessagePart[] = [];
        let hasAddedMessage = false;
        // Track in-flight tool calls by source so we can update their status
        const pendingTools = new Map<string, number>(); // source -> index in collectedParts

        for await (const event of streamChatMessageAgentic(request, { token, agentUrl, signal: controller.signal })) {
          const newEvent: ExecutionEvent = {
            type: event.type,
            source: event.data?.source,
            message: event.data?.message,
            data: event.data,
            timestamp: new Date(),
          };

          if (event.data?.source && !event.data.source.includes('dispatcher')) {
            setStreamingAgentName(event.data.source);
          }

          switch (event.type) {
            case 'conversation_created':
              setConversationId(event.data.conversation_id);
              break;

            case 'thought':
            case 'plan':
            case 'progress':
              collectedThoughts = [...collectedThoughts, newEvent];
              setThoughts(collectedThoughts);
              break;

            case 'tool_start':
              {
                collectedThoughts = [...collectedThoughts, newEvent];
                setThoughts(collectedThoughts);
                const toolSource = event.data?.source || 'tool';
                const toolName = String(event.data?.data?.tool_name || event.data?.data?.display_name || toolSource);
                const toolPart: MessagePart = {
                  type: 'tool_call',
                  id: `tool-${Date.now()}-${toolName}`,
                  name: toolName,
                  displayName: String(event.data?.data?.display_name || event.data?.message || toolName),
                  status: 'running',
                  input: (event.data?.data || undefined) as Record<string, unknown> | undefined,
                  startedAt: new Date(),
                };
                pendingTools.set(toolSource, collectedParts.length);
                collectedParts = [...collectedParts, toolPart];
                setStreamingParts(collectedParts);
              }
              break;

            case 'tool_result':
              {
                collectedThoughts = [...collectedThoughts, newEvent];
                setThoughts(collectedThoughts);
                const resultSource = event.data?.source || 'tool';
                const idx = pendingTools.get(resultSource);
                if (idx !== undefined && collectedParts[idx]?.type === 'tool_call') {
                  const existing = collectedParts[idx] as Extract<MessagePart, { type: 'tool_call' }>;
                  const updated: MessagePart = {
                    ...existing,
                    status: event.data?.data?.success === false ? 'error' : 'completed',
                    output: event.data?.message || undefined,
                    error: event.data?.data?.success === false ? String(event.data?.message || 'Failed') : undefined,
                    completedAt: new Date(),
                  };
                  collectedParts = [...collectedParts];
                  collectedParts[idx] = updated;
                  pendingTools.delete(resultSource);
                } else {
                  // No matching tool_start; append as a standalone completed tool
                  const toolName = String(event.data?.data?.tool_name || event.data?.data?.display_name || resultSource);
                  collectedParts = [...collectedParts, {
                    type: 'tool_call',
                    id: `tool-${Date.now()}-${toolName}`,
                    name: toolName,
                    displayName: String(event.data?.data?.display_name || toolName),
                    status: event.data?.data?.success === false ? 'error' : 'completed',
                    output: event.data?.message || undefined,
                    completedAt: new Date(),
                  }];
                }
                setStreamingParts(collectedParts);
              }
              break;

            case 'interim':
              {
                const payload = event.data || {};
                const nested = payload.data || {};
                const interimMessage = String(payload.message || '').trim();
                const audioUrl = typeof nested.audio_url === 'string' ? nested.audio_url : '';
                const rendered = audioUrl
                  ? `${interimMessage || 'Voice output ready'} (${audioUrl})`
                  : interimMessage;
                if (rendered) {
                  setInterimMessages(prev => [...prev, rendered]);
                }
              }
              break;

            case 'content':
              {
                const contentData = event.data?.data || {};
                const msgText = event.data?.message || '';
                
                if (contentData.streaming && contentData.partial) {
                  fullContent += msgText;
                } else if (contentData.complete) {
                  // Final marker
                } else if (msgText) {
                  fullContent = msgText;
                }

                const thinkTexts = extractThinkContent(fullContent);
                if (thinkTexts.length > 0) {
                  const thinkThought: ExecutionEvent = {
                    type: 'thought',
                    source: 'model',
                    message: thinkTexts.join('\n\n'),
                    data: event.data,
                    timestamp: new Date(),
                  };
                  const hasModelThought = collectedThoughts.some(
                    t => t.source === 'model' && t.type === 'thought'
                  );
                  if (hasModelThought) {
                    collectedThoughts = collectedThoughts.map(t =>
                      t.source === 'model' && t.type === 'thought' ? thinkThought : t
                    );
                  } else {
                    collectedThoughts = [...collectedThoughts, thinkThought];
                  }
                  setThoughts(collectedThoughts);
                }

                setStreamingContent(stripThinkTags(fullContent));
              }
              break;

            case 'prompt':
              {
                const promptOptions = event.data?.data?.options || event.data?.options;
                if (promptOptions && Array.isArray(promptOptions)) {
                  setQuickReplies(promptOptions);
                  setPromptActive(true);

                  // Add a prompt part for rendering
                  const promptType = (event.data?.data?.prompt_type || 'choice') as 'confirm' | 'choice' | 'open';
                  collectedParts = [...collectedParts, { type: 'prompt', options: promptOptions, promptType }];
                  setStreamingParts(collectedParts);

                  // Finalize accumulated content as a completed message
                  const cleanedSoFar = stripThinkTags(fullContent);
                  if (cleanedSoFar && !hasAddedMessage) {
                    const assistantMessage: DisplayMessage = {
                      role: 'assistant',
                      content: cleanedSoFar,
                      timestamp: new Date(),
                      thoughts: collectedThoughts.length > 0 ? collectedThoughts : undefined,
                      agentName: streamingAgentName,
                      parts: collectedParts,
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
              break;

            case 'complete':
              break;

            case 'message_complete':
              if (!hasAddedMessage) {
                setConversationId(event.data.conversation_id);
                
                const cleanedContent = stripThinkTags(fullContent);
                if (cleanedContent) {
                  // Build final text part if there's content not yet in parts
                  const finalParts: MessagePart[] = [
                    ...collectedParts,
                    { type: 'text', content: cleanedContent },
                  ];
                  const assistantMessage: DisplayMessage = {
                    role: 'assistant',
                    content: cleanedContent,
                    timestamp: new Date(),
                    thoughts: collectedThoughts.length > 0 ? collectedThoughts : undefined,
                    agentName: streamingAgentName,
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
              break;

            case 'error':
              {
                const errorMessage = event.data?.message || event.data?.error || 'An error occurred';
                const errorSource = event.data?.source || event.data?.data?.source || '';
                const isToolError = errorSource && !errorSource.includes('agent') && !errorSource.includes('dispatcher');

                if (isToolError) {
                  collectedThoughts = [...collectedThoughts, {
                    type: 'error' as const,
                    source: errorSource,
                    message: `Tool error (${errorSource}): ${errorMessage}`,
                    data: event.data,
                    timestamp: new Date(),
                  }];
                  setThoughts(collectedThoughts);

                  // Update matching pending tool part to error status
                  const errIdx = pendingTools.get(errorSource);
                  if (errIdx !== undefined && collectedParts[errIdx]?.type === 'tool_call') {
                    const existing = collectedParts[errIdx] as Extract<MessagePart, { type: 'tool_call' }>;
                    collectedParts = [...collectedParts];
                    collectedParts[errIdx] = { ...existing, status: 'error', error: errorMessage, completedAt: new Date() };
                    pendingTools.delete(errorSource);
                    setStreamingParts(collectedParts);
                  }
                } else {
                  toast.error(errorMessage);

                  if (!hasAddedMessage) {
                    const errorContent = fullContent.trim()
                      ? `${fullContent}\n\n**Error:** ${errorMessage}`
                      : `**Error:** ${errorMessage}`;
                    const errorAssistantMessage: DisplayMessage = {
                      role: 'assistant',
                      content: errorContent,
                      timestamp: new Date(),
                      thoughts: collectedThoughts.length > 0 ? collectedThoughts : undefined,
                      agentName: streamingAgentName,
                      parts: collectedParts,
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
              }
              break;
          }
        }
      } else if (useStreaming) {
        // Standard streaming response
        setStreamingContent('');
        setExecutionEvents([]);
        let fullContent = '';
        let collectedEvents: ExecutionEvent[] = [];

        for await (const event of streamChatMessage(request, { token, agentUrl, signal: controller.signal })) {
          const newEvent: ExecutionEvent = {
            type: event.type,
            message: event.data?.message,
            data: event.data,
            timestamp: new Date(),
          };

          switch (event.type) {
            case 'conversation_created':
              setConversationId(event.data.conversation_id);
              break;

            case 'planning':
            case 'tool_start':
            case 'agent_start':
            case 'agent_response_start':
            case 'synthesis_start':
              collectedEvents = [...collectedEvents, newEvent];
              setExecutionEvents(collectedEvents);
              break;

            case 'tool_result':
            case 'agent_result':
            case 'routing_decision':
            case 'model_selected':
              collectedEvents = [...collectedEvents, newEvent];
              setExecutionEvents(collectedEvents);
              break;

            case 'content_chunk':
              // Only append if chunk is defined and not empty
              if (event.data.chunk !== undefined && event.data.chunk !== null) {
                fullContent += event.data.chunk;
                setStreamingContent(fullContent);
              }
              break;

            case 'execution_complete':
              // Clear execution events when content starts flowing
              break;

            case 'message_complete':
              setConversationId(event.data.conversation_id);
              
              // Add assistant message to display
              const assistantMessage: DisplayMessage = {
                role: 'assistant',
                content: fullContent,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, assistantMessage]);
              setStreamingContent('');
              setExecutionEvents([]);

              // Callback
              onResponseReceived?.(fullContent);
              break;

            case 'error':
              const streamErrorMessage = event.data?.error || 'An error occurred';
              toast.error(streamErrorMessage);
              // Add error message to chat
              const streamErrorAssistantMessage: DisplayMessage = {
                role: 'assistant',
                content: `⚠️ **Error:** ${streamErrorMessage}`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, streamErrorAssistantMessage]);
              setStreamingContent('');
              setExecutionEvents([]);
              break;
          }
        }
      } else {
        // Non-streaming response
        const response = await sendChatMessage(request, { token, agentUrl });

        setConversationId(response.conversation_id);

        // Add assistant message to display
        const assistantMessage: DisplayMessage = {
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Callback
        onResponseReceived?.(response.content);
      }

      // Clear attachments after successful send
      setAttachments([]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was cancelled - add partial response if any
        if (streamingContent) {
          const partialMessage: DisplayMessage = {
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
          role: 'assistant',
          content: `❌ Error: ${error.message || 'Failed to send message'}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      setExecutionEvents([]);
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
    setExecutionEvents([]);
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
          'Authorization': `Bearer ${token}`,
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
          'Authorization': `Bearer ${token}`,
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
              const displayMessages = messages.map(m => ({
                id: m.id || `msg-${Math.random()}`,
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
            streamingContent={!useAgenticStreaming ? streamingContent : undefined}
            streamingAgentName={streamingAgentName}
            isLoading={!useAgenticStreaming && isLoading && messages.length === 0}
            onDeleteMessage={handleDeleteMessage}
            onRetryMessage={handleRetryMessage}
            onSuggestedAction={(action) => handleSubmit(null, action)}
          />
        )}

        {/* Agentic streaming content with ThinkingToggle and tool-call cards */}
        {useAgenticStreaming && (isLoading || streamingContent) && !promptActive && (
          <div className="flex gap-4 justify-start">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
                {streamingAgentName?.charAt(0).toUpperCase() || 'A'}
              </div>
              {streamingAgentName && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium capitalize">
                  {streamingAgentName}
                </span>
              )}
            </div>
            <div className="max-w-3xl flex-1">
              <div className="rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {/* ThinkingToggle component */}
                {thoughts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 text-xs">
                    <ThinkingToggle thoughts={thoughts} isActive={isLoading && !streamingContent} />
                  </div>
                )}

                {/* Live tool-call cards from streaming parts */}
                {streamingParts.filter(p => p.type === 'tool_call').length > 0 && (
                  <div className="mb-2">
                    {streamingParts
                      .filter((p): p is Extract<MessagePart, { type: 'tool_call' }> => p.type === 'tool_call')
                      .map((part) => (
                        <StreamingToolCard key={part.id} part={part} />
                      ))}
                  </div>
                )}

                {interimMessages.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {interimMessages.map((msg, idx) => (
                      <div
                        key={`interim-${idx}`}
                        className="text-xs rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 text-amber-800 dark:text-amber-200"
                      >
                        {msg}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Streaming content or loading indicator */}
                {streamingContent ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h1:mt-4 prose-h1:mb-3 prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-base prose-h3:mt-3 prose-h3:mb-2 prose-p:my-2 prose-p:leading-relaxed prose-ul:my-3 prose-ol:my-3 prose-li:my-0.5 prose-hr:my-6 prose-strong:font-semibold prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:border prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={streamingMarkdownComponents}
                    >
                      {preprocessLatex(streamingContent)}
                    </ReactMarkdown>
                    <span className="inline-block w-2 h-4 bg-gray-400 dark:bg-gray-500 animate-pulse ml-1"></span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Execution status - show what's happening (legacy, non-agentic) */}
        {!useAgenticStreaming && isLoading && executionEvents.length > 0 && !streamingContent && (
          <ExecutionStatus events={executionEvents} isActive={isLoading} />
        )}

        {/* Loading indicator - only show if no events and no streaming (non-agentic) */}
        {!useAgenticStreaming && isLoading && !streamingContent && executionEvents.length === 0 && (
          <div className="flex gap-3 justify-start">
            <div className="bg-blue-600 dark:bg-blue-500 rounded-full p-2 h-8 w-8 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="max-w-[80%] rounded-lg p-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

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
                if (input.trim() && (!isLoading || promptActive)) {
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }
            }}
            placeholder={promptActive ? 'Type your reply...' : placeholder}
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
            style={{ minHeight: '40px', maxHeight: '200px' }}
            disabled={isLoading && !promptActive}
          />
          {isLoading && !promptActive ? (
            <button
              type="button"
              onClick={handleCancel}
              className="bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium flex-shrink-0"
              title="Cancel"
            >
              <span className="w-5 h-5 flex items-center justify-center">⏹</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
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

