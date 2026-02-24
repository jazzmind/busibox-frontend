'use client';

import { useState, useEffect, useRef } from 'react';

interface Citation {
  filename: string;
  pageNumber?: number;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: {
    agentId?: string;
    processingTime?: number;
    error?: boolean;
    // RAG-specific metadata
    isRAGResponse?: boolean;
    citations?: string[];
    sourcesFound?: boolean;
  };
}

interface Agent {
  id: string;
  name: string;
  displayName: string;
  description: string;
  scopes: string[];
}

interface ClientSession {
  clientId: string;
  clientSecret: string;
  isAuthenticated: boolean;
  accessToken?: string;
  scopes?: string[];
  selectedAgent?: string;
}

interface ChatInterfaceProps {
  session: ClientSession;
  agents: Agent[];
  onBackToAgents: () => void;
}

// Document-aware agents that show RAG-specific UI
const DOCUMENT_AGENTS = [
  'documentAgent',
  'ragChatAgent',
  'rfp-analysis-agent',
  'rfp-analyzer-agent',
  'rag-search-agent',
];

// Citations display component
function CitationsDisplay({ citations }: { citations: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!citations || citations.length === 0) return null;
  
  return (
    <div className="mt-3 pt-3 border-t border-gray-200/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center space-x-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
      >
        <svg 
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">📚 {citations.length} Source{citations.length !== 1 ? 's' : ''}</span>
      </button>
      
      {isExpanded && (
        <div className="mt-2 space-y-1">
          {citations.map((citation, index) => (
            <div 
              key={index}
              className="flex items-center space-x-2 text-xs text-gray-600 bg-blue-50 rounded px-2 py-1"
            >
              <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{citation}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// RAG badge component
function RAGBadge({ sourcesFound }: { sourcesFound: boolean }) {
  return (
    <div className={`inline-flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full ${
      sourcesFound 
        ? 'bg-green-100 text-green-700' 
        : 'bg-amber-100 text-amber-700'
    }`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span>{sourcesFound ? 'Document-sourced' : 'No documents found'}</span>
    </div>
  );
}

export default function ChatInterface({ session, agents, onBackToAgents }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedAgent = agents.find(agent => agent.id === session.selectedAgent);
  const isDocumentAgent = selectedAgent && DOCUMENT_AGENTS.includes(selectedAgent.id);

  useEffect(() => {
    setIsMounted(true);
    // Add welcome message from the selected agent
    if (selectedAgent) {
      let welcomeContent = `Hello! I'm ${selectedAgent.displayName}. ${selectedAgent.description} How can I help you today?`;
      
      // Add document-specific welcome for RAG agents
      if (isDocumentAgent) {
        welcomeContent += '\n\n📚 I have access to your uploaded documents and can search through them to answer your questions. Just ask me anything!';
      }
      
      const welcomeMessage: Message = {
        id: 'welcome',
        content: welcomeContent,
        role: 'assistant',
        timestamp: new Date(),
        metadata: { agentId: selectedAgent.id }
      };
      setMessages([welcomeMessage]);
    }
  }, [selectedAgent, isDocumentAgent]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !selectedAgent) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const startTime = Date.now();

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/simulator/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          messages: [{ role: 'user', content: input.trim() }],
        }),
      });

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.text || 'Sorry, I couldn\'t process that request.',
        role: 'assistant',
        timestamp: new Date(),
        metadata: {
          agentId: selectedAgent.id,
          processingTime,
          // RAG-specific metadata from response
          isRAGResponse: data.isRAGResponse,
          citations: data.citations,
          sourcesFound: data.sourcesFound,
        }
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, there was an error processing your request. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
        metadata: {
          agentId: selectedAgent?.id,
          error: true,
          processingTime: Date.now() - startTime
        }
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (selectedAgent) {
      let welcomeContent = `Hello! I'm ${selectedAgent.displayName}. ${selectedAgent.description} How can I help you today?`;
      
      if (isDocumentAgent) {
        welcomeContent += '\n\n📚 I have access to your uploaded documents and can search through them to answer your questions. Just ask me anything!';
      }
      
      const welcomeMessage: Message = {
        id: 'welcome-' + Date.now(),
        content: welcomeContent,
        role: 'assistant',
        timestamp: new Date(),
        metadata: { agentId: selectedAgent.id }
      };
      setMessages([welcomeMessage]);
    }
  };

  if (!selectedAgent) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No agent selected</p>
        <button
          onClick={onBackToAgents}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Select Agent
        </button>
      </div>
    );
  }

  // Dynamic suggestions based on agent type
  const suggestions = isDocumentAgent 
    ? [
        'What documents do I have?',
        'Search for quarterly reports',
        'Summarize my latest document',
        'Find information about...'
      ]
    : [
        'What can you help me with?',
        'Tell me about your capabilities',
        'How do you work?',
        'Show me an example'
      ];

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToAgents}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              isDocumentAgent 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600' 
                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
            }`}>
              <span className="text-white text-xl">{isDocumentAgent ? '📚' : '🤖'}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{selectedAgent.displayName}</h2>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-500">{selectedAgent.name}</p>
                {isDocumentAgent && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                    RAG-enabled
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={clearChat}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Clear Chat
          </button>
          <div className="flex items-center space-x-1 text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Connected</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                  : message.metadata?.error
                  ? 'bg-red-50 text-red-900 border border-red-200'
                  : message.metadata?.isRAGResponse
                  ? 'bg-emerald-50 text-gray-900 border border-emerald-200'
                  : 'bg-gray-50 text-gray-900 border border-gray-200'
              }`}
            >
              {/* RAG Badge for document-sourced responses */}
              {message.role === 'assistant' && message.metadata?.isRAGResponse && (
                <div className="mb-2">
                  <RAGBadge sourcesFound={message.metadata.sourcesFound || false} />
                </div>
              )}
              
              <p className="whitespace-pre-wrap">{message.content}</p>
              
              {/* Citations display */}
              {message.role === 'assistant' && message.metadata?.citations && message.metadata.citations.length > 0 && (
                <CitationsDisplay citations={message.metadata.citations} />
              )}
              
              <div className="flex items-center justify-between mt-2 text-xs">
                <span
                  className={`${
                    message.role === 'user'
                      ? 'text-blue-100'
                      : message.metadata?.error
                      ? 'text-red-600'
                      : message.metadata?.isRAGResponse
                      ? 'text-emerald-600'
                      : 'text-gray-500'
                  }`}
                >
                  {isMounted ? message.timestamp.toLocaleTimeString() : ''}
                </span>
                {message.metadata?.processingTime && (
                  <span
                    className={`ml-2 ${
                      message.role === 'user'
                        ? 'text-blue-100'
                        : message.metadata?.error
                        ? 'text-red-600'
                        : message.metadata?.isRAGResponse
                        ? 'text-emerald-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {message.metadata.processingTime}ms
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className={`rounded-lg px-4 py-3 max-w-[75%] ${
              isDocumentAgent 
                ? 'bg-emerald-50 border border-emerald-200' 
                : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center space-x-2">
                <div className="animate-pulse flex space-x-1">
                  <div className={`w-2 h-2 rounded-full ${isDocumentAgent ? 'bg-emerald-400' : 'bg-gray-400'}`}></div>
                  <div className={`w-2 h-2 rounded-full ${isDocumentAgent ? 'bg-emerald-400' : 'bg-gray-400'}`}></div>
                  <div className={`w-2 h-2 rounded-full ${isDocumentAgent ? 'bg-emerald-400' : 'bg-gray-400'}`}></div>
                </div>
                <span className={isDocumentAgent ? 'text-emerald-600' : 'text-gray-500'}>
                  {isDocumentAgent 
                    ? `${selectedAgent.displayName} is searching documents...` 
                    : `${selectedAgent.displayName} is thinking...`
                  }
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t border-gray-200/50 px-6 py-4">
        <form onSubmit={sendMessage} className="space-y-3">
          <div className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isDocumentAgent 
                ? `Ask about your documents...`
                : `Ask ${selectedAgent.displayName} anything...`
              }
              className={`flex-1 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
                isDocumentAgent 
                  ? 'border-emerald-300 focus:ring-emerald-500' 
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`px-6 py-3 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2 text-white ${
                isDocumentAgent 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:ring-emerald-500' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:ring-blue-500'
              }`}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              <span>{isLoading ? 'Sending...' : 'Send'}</span>
            </button>
          </div>
          
          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => !isLoading && setInput(suggestion)}
                  className={`text-sm px-3 py-1 rounded-full transition-colors disabled:opacity-50 ${
                    isDocumentAgent 
                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                  disabled={isLoading}
                  type="button"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
