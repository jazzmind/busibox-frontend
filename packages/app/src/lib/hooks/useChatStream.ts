'use client';

import { useState, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { stripThinkTags } from '../../components/chat/chat-utils';
import { streamChatMessageAgentic } from '../agent/chat-client';
import { createAccumulator, processStreamEvent } from '../agent/stream-event-processor';
import type { ChatMessageRequest, MessagePart, ThoughtEvent } from '../../types/chat';

export interface StreamState {
  content: string;
  thoughts: ThoughtEvent[];
  parts: MessagePart[];
  agentName?: string;
  interimMessages: string[];
  quickReplies: string[];
  promptActive: boolean;
  isStreaming: boolean;
  conversationId?: string;
}

export interface StreamResult {
  content: string;
  thoughts: ThoughtEvent[];
  parts: MessagePart[];
  agentName?: string;
  interimMessages: string[];
  conversationId?: string;
}

interface UseChatStreamOptions {
  token: string;
  agentUrl?: string;
  onConversationCreated?: (id: string, title?: string) => void;
  onTitleUpdate?: (id: string, title: string) => void;
}

const INITIAL_STATE: StreamState = {
  content: '',
  thoughts: [],
  parts: [],
  agentName: undefined,
  interimMessages: [],
  quickReplies: [],
  promptActive: false,
  isStreaming: false,
  conversationId: undefined,
};

export function useChatStream({ token, agentUrl, onConversationCreated, onTitleUpdate }: UseChatStreamOptions) {
  const [state, setState] = useState<StreamState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    request: ChatMessageRequest,
  ): Promise<StreamResult> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const accumulated = createAccumulator();

    // Use flushSync for the initial state reset so the UI clears immediately.
    flushSync(() => {
      setState(prev => ({
        ...prev,
        content: '',
        thoughts: [],
        parts: [],
        interimMessages: [],
        quickReplies: [],
        promptActive: false,
        isStreaming: true,
        conversationId: request.conversation_id || prev.conversationId,
      }));
    });

    let resultConversationId = request.conversation_id;

    try {
      for await (const event of streamChatMessageAgentic(request, {
        token,
        agentUrl,
        signal: controller.signal,
      })) {
        const parsed = event.data;
        const result = processStreamEvent(event.type, parsed, accumulated);

        if (result.conversationId && !result.titleUpdate) {
          resultConversationId = result.conversationId;
          onConversationCreated?.(result.conversationId, result.title);
        }

        if (result.titleUpdate) {
          onTitleUpdate?.(result.titleUpdate.id, result.titleUpdate.title);
        }

        // flushSync forces React to commit this state update to the DOM
        // immediately rather than batching it. Without this, React 18's
        // automatic batching delays all setState calls inside the async
        // generator until the promise resolves, so the parent component
        // never sees intermediate streaming updates.
        flushSync(() => {
          setState(prev => ({
            ...prev,
            content: result.content ?? prev.content,
            thoughts: result.thoughts ?? prev.thoughts,
            parts: result.parts ?? prev.parts,
            agentName: accumulated.agentName ?? prev.agentName,
            interimMessages: result.interimMessages ?? prev.interimMessages,
            quickReplies: result.quickReplies ?? prev.quickReplies,
            promptActive: result.promptActive ?? prev.promptActive,
            conversationId: resultConversationId,
          }));
        });

        if (result.error) {
          throw new Error(result.error);
        }
      }
    } finally {
      flushSync(() => {
        setState(prev => ({
          ...prev,
          isStreaming: false,
          content: '',
          thoughts: [],
          parts: [],
          agentName: undefined,
          interimMessages: [],
        }));
      });
      abortControllerRef.current = null;
    }

    return {
      content: stripThinkTags(accumulated.fullContent),
      thoughts: accumulated.thoughts,
      parts: accumulated.parts,
      agentName: accumulated.agentName,
      interimMessages: accumulated.interimMessages,
      conversationId: resultConversationId,
    };
  }, [token, agentUrl, onConversationCreated, onTitleUpdate]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const resetPrompt = useCallback(() => {
    setState(prev => ({ ...prev, quickReplies: [], promptActive: false }));
  }, []);

  return {
    state,
    sendMessage,
    cancel,
    resetPrompt,
  };
}
