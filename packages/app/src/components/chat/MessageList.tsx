/**
 * Message List Component
 * 
 * Displays messages in chronological order with streaming support
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import toast from 'react-hot-toast';
import { ThinkingToggle, ThoughtEvent } from './ThinkingToggle';
import { RawContentToggle } from './RawContentToggle';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  agentName?: string; // Name of the responding agent
  thoughts?: ThoughtEvent[]; // Stored thoughts/reasoning for this message
  attachments?: Array<{
    id: string;
    filename: string;
    fileUrl: string;
    mimeType: string;
    sizeBytes?: number;
    addedToLibrary?: boolean;
  }>;
  webSearchResults?: Array<{
    title: string;
    url: string;
    snippet: string;
    score?: number;
  }>;
  docSearchResults?: Array<{
    id: string;
    title: string;
    snippet: string;
    source: string;
    url?: string;
    score: number;
  }>;
}

interface MessageListProps {
  messages: (Message & { modelName?: string; agentName?: string })[];
  streamingContent?: string;
  streamingAgentName?: string; // Agent name for the currently streaming message
  streamingThoughts?: ThoughtEvent[]; // Real-time thoughts during streaming
  isLoading?: boolean;
  conversationOwner?: {
    id: string;
    email: string;
  } | null;
  currentUserId?: string;
  onDeleteMessage?: (messageId: string) => void;
  onRetryMessage?: (messageContent: string, attachmentIds?: string[]) => void;
}

// Helper to get user initials from email
function getInitials(email: string): string {
  // Extract first letter before @ symbol
  const localPart = email.split('@')[0];
  if (localPart.length >= 2) {
    // Use first two characters if available
    return localPart.substring(0, 2).toUpperCase();
  }
  return localPart[0].toUpperCase();
}

// Helper to get model avatar (first letter of model name)
function getModelAvatar(modelName?: string): string {
  if (!modelName) return 'A';
  // Extract first letter from model name (e.g., "fast" -> "F", "frontier" -> "F", "chat" -> "C")
  return modelName.charAt(0).toUpperCase();
}

/**
 * Parse routing debug info from message content
 * Returns the debug info and cleaned content
 */
function parseRoutingDebug(content: string): { debug: any | null; cleanContent: string } {
  const debugMatch = content.match(/<!-- ROUTING_DEBUG:([\s\S]*?):END_ROUTING -->\n*/);
  if (debugMatch) {
    try {
      const debug = JSON.parse(debugMatch[1]);
      const cleanContent = content.replace(/<!-- ROUTING_DEBUG:[\s\S]*?:END_ROUTING -->\n*/, '');
      return { debug, cleanContent };
    } catch {
      return { debug: null, cleanContent: content };
    }
  }
  return { debug: null, cleanContent: content };
}

/**
 * Preprocesses content to ensure LaTeX is properly delimited
 * Converts LaTeX bracket notation \[ \] and \( \) to $ delimiters for KaTeX
 */
function preprocessLatex(content: string): string {
  let processed = content;
  
  // Convert \[ ... \] (display math) to $$ ... $$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, inner) => {
    return `$$${inner}$$`;
  });
  
  // Convert \( ... \) (inline math) to $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_match, inner) => {
    return `$${inner}$`;
  });
  
  return processed;
}

export function MessageList({ 
  messages, 
  streamingContent, 
  streamingAgentName,
  streamingThoughts,
  isLoading,
  conversationOwner,
  currentUserId,
  onDeleteMessage,
  onRetryMessage,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Auto-scroll to bottom only when new messages arrive or streaming updates
  // Don't scroll when messages are deleted (count decreases)
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    
    // Only scroll if message count increased or streaming content changed
    if (currentCount > prevCount || streamingContent) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    
    prevMessageCountRef.current = currentCount;
  }, [messages.length, streamingContent]);

  const formatTime = (date: Date): string => {
    try {
      return format(new Date(date), 'h:mm a');
    } catch {
      return '';
    }
  };

  const copyAsMarkdown = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      toast.success('Copied as Markdown');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const copyAsHTML = async (content: string, messageId: string) => {
    try {
      // Convert markdown to HTML using a temporary div
      const tempDiv = document.createElement('div');
      tempDiv.className = 'prose prose-sm';
      
      // Simple markdown to HTML conversion (you could use a library for more complex cases)
      let html = content;
      
      // Convert LaTeX delimiters for display
      html = preprocessLatex(html);
      
      // Basic markdown conversions
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
      html = html.replace(/\n\n/g, '</p><p>');
      html = `<p>${html}</p>`;
      
      await navigator.clipboard.writeText(html);
      setCopiedId(messageId);
      toast.success('Copied as HTML');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!onDeleteMessage) return;
    
    if (confirm('Are you sure you want to delete this message?')) {
      onDeleteMessage(messageId);
    }
  };

  const handleRetry = (message: Message) => {
    if (!onRetryMessage) return;
    
    const attachmentIds = message.attachments?.map(att => att.id);
    onRetryMessage(message.content, attachmentIds);
  };

  return (
    <div className="p-6 space-y-6">
      {messages.length === 0 && !isLoading && (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p className="text-lg">No messages yet</p>
            <p className="text-sm mt-2">Start a conversation by sending a message</p>
          </div>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`group flex gap-4 ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          {message.role === 'assistant' && (
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
                {getModelAvatar((message as any).agentName || (message as any).modelName)}
              </div>
              {(message as any).agentName && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium capitalize">
                  {(message as any).agentName}
                </span>
              )}
            </div>
          )}
          
          {message.role === 'user' && conversationOwner && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
              {getInitials(conversationOwner.email)}
            </div>
          )}

          <div
            className={`max-w-3xl ${
              message.role === 'user' ? 'order-2' : 'order-2'
            }`}
          >
            <div
              className={`rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }`}
            >
              {message.role === 'assistant' ? (
                (() => {
                  const { debug: routingDebug, cleanContent } = parseRoutingDebug(message.content);
                  return (
                    <>
                      {/* Debug Options - using separate components for maintainability */}
                      <div className="flex flex-wrap gap-2 mb-2 text-xs">
                        {/* Thinking/Reasoning toggle */}
                        {message.thoughts && message.thoughts.length > 0 && (
                          <ThinkingToggle thoughts={message.thoughts} />
                        )}
                        
                        {/* Request Debug */}
                        {routingDebug?.request && (
                          <details className="inline">
                            <summary className="cursor-pointer text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded">
                              📤 Request
                            </summary>
                            <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs space-y-1">
                              <div><strong>Model:</strong> {routingDebug.request.model}</div>
                              <div><strong>UI Capabilities:</strong> multimodal={String(routingDebug.request.uiCapabilities?.multimodal)}, tools={String(routingDebug.request.uiCapabilities?.toolCalling)}</div>
                              <div><strong>Native Capabilities:</strong> multimodal={String(routingDebug.request.nativeCapabilities?.multimodal)}, tools={String(routingDebug.request.nativeCapabilities?.toolCalling)}</div>
                              <div><strong>Web Search:</strong> {routingDebug.request.webSearchEnabled ? '✅ Enabled' : '❌ Disabled'}</div>
                              <div><strong>Doc Search:</strong> {routingDebug.request.docSearchEnabled ? '✅ Enabled' : '❌ Disabled'}</div>
                              <div><strong>Tools Available:</strong> {routingDebug.request.toolsAvailable} {routingDebug.request.toolNames?.length > 0 && `(${routingDebug.request.toolNames.join(', ')})`}</div>
                              <div><strong>Messages:</strong> {routingDebug.request.messagesCount}</div>
                              {routingDebug.request.contentAnalysis && (
                                <div><strong>Content:</strong> images={String(routingDebug.request.contentAnalysis.hasImages)}, audio={String(routingDebug.request.contentAnalysis.hasAudio)}, video={String(routingDebug.request.contentAnalysis.hasVideo)}</div>
                              )}
                            </div>
                          </details>
                        )}
                        
                        {/* Routing Debug */}
                        {routingDebug && (
                          <details className="inline">
                            <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                              🔀 Routing
                            </summary>
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs space-y-1">
                              <div><strong>Dual-Model:</strong> {routingDebug.dualModel ? 'Yes' : 'No'}</div>
                              <div><strong>Primary Model:</strong> {routingDebug.primaryModel}</div>
                              {routingDebug.toolsUsed && <div><strong>Tools Used:</strong> Yes (via {routingDebug.toolModel || 'native'})</div>}
                              {routingDebug.visionUsed && <div><strong>Vision Used:</strong> Yes (via {routingDebug.visionModel})</div>}
                              {routingDebug.visionAnalysis && (
                                <div><strong>Vision Analysis:</strong> {routingDebug.visionAnalysis}...</div>
                              )}
                              <div><strong>Routing Path:</strong></div>
                              <ul className="ml-4 list-disc">
                                {routingDebug.routingPath?.map((step: string, idx: number) => (
                                  <li key={idx}>{step}</li>
                                ))}
                              </ul>
                              {routingDebug.toolResults && routingDebug.toolResults.length > 0 && (
                                <>
                                  <div className="mt-2"><strong>Tool Executions:</strong></div>
                                  {routingDebug.toolResults.map((tr: any, idx: number) => (
                                    <div key={idx} className="ml-4 mt-1 p-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                      <div className={tr.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                        {tr.success ? '✅' : '❌'} <strong>{tr.toolName}</strong>
                                      </div>
                                      {tr.error && <div className="text-red-500 dark:text-red-400 text-xs">Error: {tr.error}</div>}
                                      {tr.resultPreview && (
                                        <details className="text-xs">
                                          <summary className="cursor-pointer text-gray-500 dark:text-gray-400">Result Preview</summary>
                                          <pre className="mt-1 p-1 bg-gray-100 dark:bg-gray-900 rounded overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                                            {tr.resultPreview}
                                          </pre>
                                        </details>
                                      )}
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          </details>
                        )}
                        
                        {/* Raw Content toggle */}
                        <RawContentToggle content={cleanContent} />
                      </div>
                      
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h1:mt-4 prose-h1:mb-3 prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-base prose-h3:mt-3 prose-h3:mb-2 prose-p:my-2 prose-p:leading-relaxed prose-ul:my-3 prose-ol:my-3 prose-li:my-0.5 prose-hr:my-6 prose-strong:font-semibold prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:border prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {preprocessLatex(cleanContent)}
                        </ReactMarkdown>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-headings:my-2 prose-pre:my-2 prose-code:text-sm prose-code:text-blue-100 prose-pre:bg-blue-700/50 prose-pre:border-blue-400/30 prose-a:text-blue-200 prose-a:underline prose-strong:text-white prose-blockquote:border-blue-300 prose-blockquote:text-blue-100 prose-hr:border-blue-400/30">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {preprocessLatex(message.content)}
                  </ReactMarkdown>
                </div>
              )}

              {/* Search Results (for assistant messages) */}
              {(message.webSearchResults || message.docSearchResults) && message.role === 'assistant' && (
                <div className="mt-3 space-y-2 border-t pt-2 border-opacity-20">
                  <div className="text-xs font-semibold opacity-75 mb-2">Sources:</div>
                  {message.webSearchResults?.map((result, idx) => (
                    <a
                      key={`web-${idx}`}
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block text-xs underline hover:no-underline ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-600'
                      }`}
                    >
                      🌐 {result.title}
                    </a>
                  ))}
                  {message.docSearchResults?.map((result, idx) => (
                    <a
                      key={`doc-${idx}`}
                      href={result.url || '#'}
                      className={`block text-xs underline hover:no-underline ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-600'
                      }`}
                    >
                      📄 {result.title} ({result.source})
                    </a>
                  ))}
                </div>
              )}

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-3 space-y-2 border-t pt-2 border-opacity-20">
                  {message.attachments.map((attachment) => {
                    const getFileIcon = (mimeType: string) => {
                      if (mimeType.startsWith('image/')) return '🖼️';
                      if (mimeType === 'application/pdf') return '📄';
                      if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
                      return '📎';
                    };

                    const formatSize = (bytes?: number) => {
                      if (!bytes) return '';
                      if (bytes < 1024) return `${bytes} B`;
                      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                    };

                    const fileId = attachment.fileUrl?.match(/\/files\/([^/]+)\/download/)?.[1];
                    const bp = process.env.NEXT_PUBLIC_BASE_PATH || '';
                    const docUrl = fileId ? `${bp}/documents/${fileId}` : attachment.fileUrl;

                    return (
                      <div
                        key={attachment.id}
                        className={`flex items-center gap-2 text-sm ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-700'
                        }`}
                      >
                        <span>{getFileIcon(attachment.mimeType)}</span>
                        <a
                          href={docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:no-underline flex-1"
                        >
                          {attachment.filename}
                        </a>
                        {attachment.sizeBytes && (
                          <span className="text-xs opacity-75">
                            {formatSize(attachment.sizeBytes)}
                          </span>
                        )}
                        {attachment.addedToLibrary && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              message.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            Library
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div
              className={`flex items-center gap-2 mt-1 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <span className="text-xs text-gray-500">
                {formatTime(message.createdAt)}
              </span>
              
              {/* Action buttons - shown on hover */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Copy as Markdown */}
                <button
                  onClick={() => copyAsMarkdown(message.content, message.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  title="Copy as Markdown"
                >
                  {copiedId === message.id ? (
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                
                {/* Copy as HTML */}
                <button
                  onClick={() => copyAsHTML(message.content, message.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  title="Copy as HTML"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </button>
                
                {/* Retry message (user messages only) */}
                {message.role === 'user' && onRetryMessage && (
                  <button
                    onClick={() => handleRetry(message)}
                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="Retry this message"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
                
                {/* Delete message - show when handler is provided and user owns conversation (or no owner check needed) */}
                {onDeleteMessage && (!conversationOwner || currentUserId === conversationOwner?.id) && (
                  <button
                    onClick={() => handleDelete(message.id)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete message"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      ))}

      {/* Streaming message with thoughts - show as soon as loading starts */}
      {(streamingContent || isLoading) && (
        <div className="flex gap-4 justify-start">
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
              {getModelAvatar(streamingAgentName)}
            </div>
            {streamingAgentName && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium capitalize">
                {streamingAgentName}
              </span>
            )}
          </div>
          <div className="max-w-3xl flex-1">
            <div className="rounded-lg px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              {/* Show ThinkingToggle for real-time thoughts - open by default during streaming */}
              {streamingThoughts && streamingThoughts.length > 0 && (
                <div className="mb-2">
                  <ThinkingToggle 
                    thoughts={streamingThoughts} 
                    isActive={isLoading && !streamingContent} 
                    defaultOpen={true}
                  />
                </div>
              )}
              
              {/* Show streaming content or "Thinking..." indicator */}
              {streamingContent ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h1:mt-4 prose-h1:mb-3 prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-base prose-h3:mt-3 prose-h3:mb-2 prose-p:my-2 prose-p:leading-relaxed prose-ul:my-3 prose-ol:my-3 prose-li:my-0.5 prose-hr:my-6 prose-strong:font-semibold prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:border prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {preprocessLatex(streamingContent)}
                  </ReactMarkdown>
                  <span className="inline-block w-2 h-4 bg-gray-400 dark:bg-gray-500 animate-pulse ml-1"></span>
                </div>
              ) : (
                /* Only show "Thinking..." if no thoughts are being displayed */
                !streamingThoughts?.length && (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-sm">Thinking...</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator - initial load */}
      {isLoading && messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-gray-500">Loading messages...</div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

