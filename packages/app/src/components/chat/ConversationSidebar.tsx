'use client';
/**
 * Conversation Sidebar Component
 * 
 * Displays list of user's conversations with previews and navigation
 */


import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { useCrossAppApiPath } from '../../contexts/ApiContext';

interface Conversation {
  id: string;
  title: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: {
    content: string;
    createdAt: Date;
  };
  isShared?: boolean;
  shareRole?: 'viewer' | 'editor';
  sharedBy?: string;
}

interface ConversationListResponse {
  data: Conversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function ConversationSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const resolve = useCrossAppApiPath();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConversations();
    
    // Listen for conversation updates
    const handleUpdate = () => {
      fetchConversations();
    };
    window.addEventListener('conversation-updated', handleUpdate);
    
    return () => {
      window.removeEventListener('conversation-updated', handleUpdate);
    };
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(resolve('chat', '/api/chat/conversations?limit=50'));
      if (!response.ok) {
        throw new Error('Failed to load conversations');
      }

      const data: ConversationListResponse = await response.json();
      setConversations(data.data);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      setError('Failed to load conversations');
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = async () => {
    try {
      const response = await fetch(resolve('chat', '/api/chat/conversations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const conversation = await response.json();
      router.push(`/chat/${conversation.id}`);
      router.refresh();
      toast.success('Conversation created');
    } catch (err) {
      console.error('Failed to create conversation:', err);
      setError('Failed to create conversation');
      toast.error('Failed to create conversation');
    }
  };

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const response = await fetch(resolve('chat', `/api/chat/conversations/${conversationId}`), {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      // Remove from local state
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      // If the deleted conversation was active, navigate to /chat
      if (isActive(conversationId)) {
        router.push('/chat');
      }
      
      toast.success('Conversation deleted');
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      toast.error('Failed to delete conversation');
    }
  };

  const getPreview = (conversation: Conversation): string => {
    if (conversation.lastMessage) {
      const content = conversation.lastMessage.content;
      return content.length > 60 ? content.substring(0, 60) + '...' : content;
    }
    return 'No messages yet';
  };

  const getTimeAgo = (date: Date): string => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const isActive = (conversationId: string): boolean => {
    return pathname === `/chat/${conversationId}`;
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Conversations</h2>
        </div>
        <button
          onClick={handleNewConversation}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          + New Conversation
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>
            <button
              onClick={fetchConversations}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Start a new conversation to begin</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/chat/${conversation.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/chat/${conversation.id}`); } }}
                className={`group block p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                  isActive(conversation.id) ? 'bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <h3
                    className={`text-sm font-medium truncate flex-1 ${
                      isActive(conversation.id) ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {conversation.title}
                  </h3>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    {/* Delete button - show on hover */}
                    <button
                      onClick={(e) => handleDeleteConversation(conversation.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                      title="Delete conversation"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    {conversation.isPrivate && (
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    )}
                    {conversation.isShared && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                        Shared
                      </span>
                    )}
                  </div>
                </div>
                {conversation.isShared && conversation.shareRole && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">
                    {conversation.shareRole === 'editor' ? 'Editor' : 'Viewer'} access
                  </p>
                )}
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                  {getPreview(conversation)}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                  <span>{getTimeAgo(conversation.updatedAt)}</span>
                  {conversation.messageCount > 0 && (
                    <span>{conversation.messageCount} messages</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

