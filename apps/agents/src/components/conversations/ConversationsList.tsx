'use client';

import React, { useEffect, useState } from 'react';

interface Conversation {
  id: string;
  title: string;
  user_id: string;
  message_count?: number;
  last_message?: {
    role: string;
    content: string;
    created_at: string;
  };
  created_at: string;
  updated_at: string;
}

interface ConversationsListProps {
  agentId: string;
  token?: string;
  onSelectConversation?: (conversationId: string) => void;
}

export function ConversationsList({ agentId, token, onSelectConversation }: ConversationsListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConversations() {
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`/api/conversations?agent_id=${agentId}`, {
          headers,
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load conversations');
        setConversations(data.conversations || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load conversations');
      } finally {
        setLoading(false);
      }
    }
    if (agentId) fetchConversations();
  }, [agentId, token]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelectConversation?.(id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading conversations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <div className="text-4xl mb-2">💬</div>
        <p>No conversations found with this agent.</p>
        <p className="text-sm mt-1">Conversations will appear here when users interact with this agent via chat.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} found
      </div>
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => handleSelect(conv.id)}
          className={`w-full text-left p-4 rounded-lg border transition-all ${
            selectedId === conv.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {conv.title}
              </h4>
              {conv.last_message && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                  <span className="font-medium capitalize">{conv.last_message.role}:</span>{' '}
                  {conv.last_message.content}
                </p>
              )}
            </div>
            <div className="ml-4 flex flex-col items-end text-xs text-gray-500 dark:text-gray-400">
              <span>{formatDate(conv.updated_at)}</span>
              {conv.message_count !== undefined && (
                <span className="mt-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                  {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
