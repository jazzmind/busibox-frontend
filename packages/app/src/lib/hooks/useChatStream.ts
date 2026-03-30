'use client';

import { useState, useRef, useCallback } from 'react';
import { stripThinkTags, extractThinkContent } from '../../components/chat/chat-utils';
import { streamChatMessageAgentic } from '../agent/chat-client';
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

  const processEvent = useCallback((
    eventType: string,
    parsed: any,
    accumulated: {
      fullContent: string;
      thoughts: ThoughtEvent[];
      parts: MessagePart[];
      pendingTools: Map<string, number>;
      agentName?: string;
      interimMessages: string[];
    },
  ) => {
    const newThought: ThoughtEvent = {
      type: eventType,
      source: parsed.source,
      message: parsed.message,
      data: parsed.data || parsed,
      timestamp: new Date(),
    };

    if (parsed.source && !parsed.source.includes('dispatcher')) {
      accumulated.agentName = parsed.source;
    }

    switch (eventType) {
      case 'conversation_created':
        return { conversationId: parsed.conversation_id, title: parsed.title };

      case 'title_update':
        return { titleUpdate: { id: parsed.conversation_id, title: parsed.title } };

      case 'thought':
      case 'plan':
      case 'progress':
        accumulated.thoughts = [...accumulated.thoughts, newThought];
        return { thoughts: accumulated.thoughts };

      case 'tool_start': {
        accumulated.thoughts = [...accumulated.thoughts, newThought];
        const toolSource = parsed.source || 'tool';
        const toolName = String(parsed.data?.tool_name || parsed.data?.display_name || toolSource);
        const toolPart: MessagePart = {
          type: 'tool_call',
          id: `tool-${Date.now()}-${toolName}`,
          name: toolName,
          displayName: String(parsed.data?.display_name || parsed.message || toolName),
          status: 'running',
          input: (parsed.data || undefined) as Record<string, unknown> | undefined,
          startedAt: new Date(),
        };
        accumulated.pendingTools.set(toolSource, accumulated.parts.length);
        accumulated.parts = [...accumulated.parts, toolPart];
        return { thoughts: accumulated.thoughts, parts: accumulated.parts };
      }

      case 'tool_result': {
        accumulated.thoughts = [...accumulated.thoughts, newThought];
        const resultSource = parsed.source || 'tool';
        const idx = accumulated.pendingTools.get(resultSource);
        if (idx !== undefined && accumulated.parts[idx]?.type === 'tool_call') {
          const existing = accumulated.parts[idx] as Extract<MessagePart, { type: 'tool_call' }>;
          accumulated.parts = [...accumulated.parts];
          accumulated.parts[idx] = {
            ...existing,
            status: parsed.data?.success === false ? 'error' : 'completed',
            output: parsed.message || undefined,
            error: parsed.data?.success === false ? String(parsed.message || 'Failed') : undefined,
            completedAt: new Date(),
          };
          accumulated.pendingTools.delete(resultSource);
        } else {
          const toolName = String(parsed.data?.tool_name || parsed.data?.display_name || resultSource);
          accumulated.parts = [...accumulated.parts, {
            type: 'tool_call',
            id: `tool-${Date.now()}-${toolName}`,
            name: toolName,
            displayName: String(parsed.data?.display_name || toolName),
            status: parsed.data?.success === false ? 'error' : 'completed',
            output: parsed.message || undefined,
            completedAt: new Date(),
          }];
        }
        return { thoughts: accumulated.thoughts, parts: accumulated.parts };
      }

      case 'content': {
        const contentData = parsed.data || {};
        const msgText = parsed.message || '';
        if (contentData.streaming && contentData.partial) {
          accumulated.fullContent += msgText;
        } else if (contentData.complete) {
          // Final marker
        } else if (msgText) {
          accumulated.fullContent = msgText;
        }
        return { content: stripThinkTags(accumulated.fullContent) };
      }

      case 'content_chunk':
        accumulated.fullContent += parsed.chunk || parsed.content || '';
        return { content: stripThinkTags(accumulated.fullContent) };

      case 'interim': {
        const nested = parsed.data || {};
        const interimMsg = String(parsed.message || '').trim();
        const audioUrl = typeof nested.audio_url === 'string' ? nested.audio_url : '';
        const rendered = audioUrl
          ? `${interimMsg || 'Voice output ready'} (${audioUrl})`
          : interimMsg;
        if (rendered) {
          accumulated.interimMessages = [...accumulated.interimMessages, rendered];
          return { interimMessages: accumulated.interimMessages };
        }
        return {};
      }

      case 'clarify_parallel': {
        const bgStatus = parsed.data?.background_status;
        const clarifyMsg = parsed.message || '';
        if (clarifyMsg) {
          accumulated.fullContent += clarifyMsg + '\n\n';
        }
        if (bgStatus) {
          accumulated.thoughts = [...accumulated.thoughts, {
            type: 'progress',
            source: parsed.source,
            message: String(bgStatus),
            data: { phase: 'background_work' },
            timestamp: new Date(),
          }];
        }
        const clarifyOptions = parsed.data?.options || parsed.options;
        return {
          content: stripThinkTags(accumulated.fullContent),
          thoughts: accumulated.thoughts,
          ...(clarifyOptions && Array.isArray(clarifyOptions) && clarifyOptions.length > 0
            ? { quickReplies: clarifyOptions, promptActive: true }
            : {}),
        };
      }

      case 'prompt': {
        const promptOptions = parsed.options || parsed.data?.options;
        if (promptOptions && Array.isArray(promptOptions)) {
          const promptType = (parsed.data?.prompt_type || 'choice') as 'confirm' | 'choice' | 'open';
          accumulated.parts = [...accumulated.parts, { type: 'prompt', options: promptOptions, promptType }];
          return {
            parts: accumulated.parts,
            quickReplies: promptOptions,
            promptActive: true,
          };
        }
        return {};
      }

      case 'complete':
      case 'message_complete':
        return { complete: true, conversationId: parsed.conversation_id };

      case 'error':
        return { error: parsed.error || parsed.message || 'An error occurred' };

      default:
        return {};
    }
  }, []);

  const sendMessage = useCallback(async (
    request: ChatMessageRequest,
  ): Promise<StreamResult> => {
    // Abort any in-flight stream before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const accumulated = {
      fullContent: '',
      thoughts: [] as ThoughtEvent[],
      parts: [] as MessagePart[],
      pendingTools: new Map<string, number>(),
      agentName: undefined as string | undefined,
      interimMessages: [] as string[],
    };

    // Only reset streaming-specific state; preserve conversationId from request
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

    let resultConversationId = request.conversation_id;

    try {
      for await (const event of streamChatMessageAgentic(request, {
        token,
        agentUrl,
        signal: controller.signal,
      })) {
        let parsed = event.data;
        const result = processEvent(event.type, parsed, accumulated);

        if (result.conversationId && !result.titleUpdate) {
          resultConversationId = result.conversationId;
          onConversationCreated?.(result.conversationId, result.title);
        }

        if (result.titleUpdate) {
          onTitleUpdate?.(result.titleUpdate.id, result.titleUpdate.title);
        }

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

        if (result.error) {
          throw new Error(result.error);
        }
      }
    } finally {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        content: '',
        thoughts: [],
        parts: [],
        agentName: undefined,
        interimMessages: [],
      }));
      abortControllerRef.current = null;
    }

    const finalContent = stripThinkTags(accumulated.fullContent);

    // Extract any thinking content from the raw text that wasn't caught as events
    const textThoughts = extractThinkContent(accumulated.fullContent);
    if (textThoughts.length > 0) {
      for (const t of textThoughts) {
        accumulated.thoughts.push({
          type: 'thought',
          source: accumulated.agentName,
          message: t,
          data: { phase: 'model_reasoning' },
          timestamp: new Date(),
        });
      }
    }

    return {
      content: finalContent,
      thoughts: accumulated.thoughts,
      parts: accumulated.parts,
      agentName: accumulated.agentName,
      interimMessages: accumulated.interimMessages,
      conversationId: resultConversationId,
    };
  }, [token, agentUrl, processEvent, onConversationCreated, onTitleUpdate]);

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
