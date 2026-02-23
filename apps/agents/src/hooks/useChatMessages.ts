/**
 * useChatMessages Hook
 * 
 * Manages chat messages and conversation state with:
 * - Message sending
 * - Message history
 * - Optimistic updates
 * - Error handling
 * - Persistence
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Message, Conversation } from '@/lib/types';

interface UseChatMessagesOptions {
  conversationId?: string;
  initialMessages?: Message[];
  onError?: (error: Error) => void;
}

interface UseChatMessagesReturn {
  messages: Message[];
  conversation: Conversation | null;
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string, attachments?: File[]) => Promise<void>;
  clearMessages: () => void;
  deleteMessage: (messageId: string) => void;
  retryMessage: (messageId: string) => Promise<void>;
}

export function useChatMessages(options: UseChatMessagesOptions = {}): UseChatMessagesReturn {
  const { conversationId, initialMessages = [], onError } = options;

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load conversation and messages
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    }
  }, [conversationId]);

  const loadConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }
      const data = await response.json();
      setConversation(data);
      setMessages(data.messages || []);
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error('Failed to load conversation');
      setError(error);
      onError?.(error);
    }
  };

  const sendMessage = useCallback(async (content: string, attachments?: File[]) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    // Create optimistic user message
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId || 'new',
      role: 'user',
      content,
      attachments: attachments?.map(file => ({
        id: `temp-${file.name}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: '', // Will be filled by server
      })),
      created_at: new Date().toISOString(),
    };

    // Add user message optimistically
    setMessages(prev => [...prev, userMessage]);

    try {
      // Upload attachments if any
      let uploadedAttachments: any[] = [];
      if (attachments && attachments.length > 0) {
        uploadedAttachments = await uploadFiles(attachments);
      }

      // Send message to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: content,
          attachments: uploadedAttachments,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send message' }));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();

      // Replace optimistic message with real message and add assistant response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== userMessage.id);
        return [...filtered, data.userMessage, data.assistantMessage];
      });

      // Update conversation
      if (data.conversation) {
        setConversation(data.conversation);
      }
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error('Failed to send message');
      setError(error);
      onError?.(error);

      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));

      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        conversation_id: conversationId || 'new',
        role: 'system',
        content: `Error: ${error.message}`,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, onError]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversation(null);
    setError(null);
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  const retryMessage = useCallback(async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || message.role !== 'user') {
      return;
    }

    // Remove the failed message and any subsequent messages
    const messageIndex = messages.findIndex(m => m.id === messageId);
    setMessages(prev => prev.slice(0, messageIndex));

    // Resend the message
    await sendMessage(message.content, []);
  }, [messages, sendMessage]);

  return {
    messages,
    conversation,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    deleteMessage,
    retryMessage,
  };
}

/**
 * Upload files to server
 */
async function uploadFiles(files: File[]): Promise<any[]> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload files');
  }

  return response.json();
}
