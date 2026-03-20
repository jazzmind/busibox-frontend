'use client';
/**
 * @deprecated Use ChatInterface from './ChatInterface' instead.
 * This is the old liteLLM byte-stream chat component, kept only for
 * backward compatibility. It will be removed in a future release.
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Bot, User, Loader2, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, ChatModelOption } from '../../types/chat';
import { useBusiboxApi } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';

interface ChatInterfaceProps {
  availableModels: ChatModelOption[];
  /**
   * Next.js route used for chat when falling back (defaults to /api/chat).
   * Useful for apps deployed behind a reverse-proxy with different routing.
   */
  nextChatPath?: string;
  /**
   * Service path used for direct-to-service chat (defaults to /api/chat).
   */
  serviceChatPath?: string;
}

export function ChatInterface({ availableModels, nextChatPath = '/api/chat', serviceChatPath = '/api/chat' }: ChatInterfaceProps) {
  const api = useBusiboxApi();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(availableModels.length > 0 ? availableModels[0].id : '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const body = JSON.stringify({
        messages: [...messages, userMessage],
        model: selectedModel,
      });

      const response = await fetchServiceFirstFallbackNext({
        service: {
          baseUrl: api.services?.agentApiUrl,
          path: serviceChatPath,
          init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          },
        },
        next: {
          nextApiBasePath: api.nextApiBasePath,
          path: nextChatPath,
          init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          },
        },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: [
            ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
            400,
            401,
            403,
            422,
          ],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || response.statusText);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantMessage += chunk;

        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') lastMsg.content = assistantMessage;
          return [...newMessages];
        });
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages((prev) => {
        const newMessages = prev.slice(0, -1);
        return [
          ...newMessages,
          {
            role: 'assistant',
            content: `❌ Error: ${error.message || 'Could not get a response. Please check that liteLLM is running.'}`,
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Clear all messages?')) setMessages([]);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg flex flex-col h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI Chat</h3>
            <p className="text-xs text-gray-500">Powered by liteLLM</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {availableModels.length === 0 ? (
              <option value="">No models available</option>
            ) : (
              availableModels.map((model) => (
                <option key={model.id} value={model.id} title={model.description}>
                  {model.name}
                </option>
              ))
            )}
          </select>

          <button
            onClick={handleClearChat}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Clear chat"
            disabled={messages.length === 0 || isLoading}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="mb-4">Start a conversation with the AI!</p>
            <div className="text-sm space-y-2 max-w-md mx-auto text-left">
              <p className="font-medium">Try asking:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>Explain quantum computing in simple terms</li>
                <li>Write a Python function to sort a list</li>
                <li>What are the benefits of microservices?</li>
                <li>How does blockchain technology work?</li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'assistant' && (
              <div className="bg-indigo-600 rounded-full p-2 h-8 w-8 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.content ? (
                message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-headings:my-2 prose-pre:my-2 prose-code:text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-headings:my-2 prose-pre:my-2 prose-code:text-sm prose-code:text-indigo-100 prose-pre:bg-indigo-700/50 prose-a:text-indigo-200 prose-a:underline prose-strong:text-white">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              )}
            </div>

            {message.role === 'user' && (
              <div className="bg-gray-300 rounded-full p-2 h-8 w-8 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-700" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex gap-2 items-end">
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
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !isLoading) {
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }
            }}
            placeholder="Ask a question..."
            rows={1}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            style={{ minHeight: '52px', maxHeight: '200px' }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2 font-medium disabled:cursor-not-allowed flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                Send
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}










