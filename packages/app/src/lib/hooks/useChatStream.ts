'use client';

import { useState, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { stripThinkTags } from '../../components/chat/chat-utils';
import { streamChatMessageAgentic, streamTurn, stopTurn, type ChatStreamEvent } from '../agent/chat-client';
import { createAccumulator, processStreamEvent } from '../agent/stream-event-processor';
import type { ChatMessageRequest, MessagePart, ThoughtEvent, MessageCitation } from '../../types/chat';

export interface StreamState {
  content: string;
  thoughts: ThoughtEvent[];
  parts: MessagePart[];
  citations: MessageCitation[];
  agentName?: string;
  interimMessages: string[];
  quickReplies: string[];
  promptActive: boolean;
  isStreaming: boolean;
  conversationId?: string;
  /** Server-side turn this stream belongs to (set from `turn_started`). */
  turnId?: string;
  /** True while the browser lost the stream and is reattaching to the turn. */
  reconnecting: boolean;
}

export interface StreamResult {
  content: string;
  thoughts: ThoughtEvent[];
  parts: MessagePart[];
  citations: MessageCitation[];
  agentName?: string;
  interimMessages: string[];
  conversationId?: string;
  turnId?: string;
  /** Terminal status from `turn_finished` (completed | failed | cancelled | interrupted). */
  status?: string;
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
  citations: [],
  agentName: undefined,
  interimMessages: [],
  quickReplies: [],
  promptActive: false,
  isStreaming: false,
  conversationId: undefined,
  turnId: undefined,
  reconnecting: false,
};

/** Reattach schedule after a dropped connection: ~1 min of attempts, then give up. */
const REATTACH_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000];

const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';

/**
 * Streams a chat turn and keeps the UI in step with it.
 *
 * Turns run server-side; this hook is a subscriber. If the connection drops
 * (laptop sleep, flaky Wi-Fi) it reattaches to the same turn from the last
 * event it saw, so nothing is re-run and nothing is lost. `resumeTurn` does
 * the same for a page that loads while a turn is still running.
 */
export function useChatStream({ token, agentUrl, onConversationCreated, onTitleUpdate }: UseChatStreamOptions) {
  const [state, setState] = useState<StreamState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);
  const turnRef = useRef<{ turnId?: string; lastEventId?: string; finished: boolean; status?: string }>({ finished: false });

  const resetForNewStream = useCallback((conversationId?: string) => {
    flushSync(() => {
      setState(prev => ({
        ...prev,
        content: '',
        thoughts: [],
        parts: [],
        citations: [],
        interimMessages: [],
        quickReplies: [],
        promptActive: false,
        isStreaming: true,
        reconnecting: false,
        turnId: undefined,
        conversationId: conversationId || prev.conversationId,
      }));
    });
  }, []);

  /**
   * Drain one event stream into the accumulator, tracking the turn cursor.
   * Returns when the stream ends (naturally, on turn_finished, or on abort).
   */
  const consume = useCallback(async (
    events: AsyncGenerator<ChatStreamEvent>,
    accumulated: ReturnType<typeof createAccumulator>,
    conv: { id?: string },
  ) => {
    for await (const event of events) {
      if (event.id) turnRef.current.lastEventId = event.id;
      const parsed = event.data;

      if (event.type === 'turn_started') {
        turnRef.current.turnId = parsed?.turn_id;
        flushSync(() => setState(prev => ({ ...prev, turnId: parsed?.turn_id, reconnecting: false })));
        continue;
      }
      if (event.type === 'turn_finished') {
        turnRef.current.finished = true;
        turnRef.current.status = parsed?.status;
        if (parsed?.status === 'failed' && parsed?.error && !accumulated.fullContent) {
          throw new Error(parsed.error);
        }
        return;
      }

      const result = processStreamEvent(event.type, parsed, accumulated);

      if (result.conversationId && !result.titleUpdate) {
        conv.id = result.conversationId;
        onConversationCreated?.(result.conversationId, result.title);
      }
      if (result.titleUpdate) {
        onTitleUpdate?.(result.titleUpdate.id, result.titleUpdate.title);
      }

      // flushSync forces React to commit this state update immediately rather
      // than batching it until the async generator resolves.
      flushSync(() => {
        setState(prev => ({
          ...prev,
          content: result.content ?? prev.content,
          thoughts: result.thoughts ?? prev.thoughts,
          parts: result.parts ?? prev.parts,
          citations: result.citations ?? prev.citations,
          agentName: accumulated.agentName ?? prev.agentName,
          interimMessages: result.interimMessages ?? prev.interimMessages,
          quickReplies: result.quickReplies ?? prev.quickReplies,
          promptActive: result.promptActive ?? prev.promptActive,
          conversationId: conv.id,
          reconnecting: false,
        }));
      });

      if (result.error) {
        throw new Error(result.error);
      }
    }
  }, [onConversationCreated, onTitleUpdate]);

  /** After a dropped connection, reattach to the running turn with backoff. */
  const reattach = useCallback(async (
    accumulated: ReturnType<typeof createAccumulator>,
    conv: { id?: string },
    signal: AbortSignal,
  ): Promise<boolean> => {
    const turnId = turnRef.current.turnId;
    if (!turnId) return false;
    for (const delay of REATTACH_DELAYS_MS) {
      if (signal.aborted || turnRef.current.finished) return turnRef.current.finished;
      flushSync(() => setState(prev => ({ ...prev, reconnecting: true })));
      await new Promise<void>(resolve => setTimeout(resolve, delay));
      if (signal.aborted) return false;
      try {
        await consume(
          streamTurn(turnId, turnRef.current.lastEventId, { token, agentUrl, signal }),
          accumulated,
          conv,
        );
        return true; // stream ended normally (turn finished)
      } catch (e) {
        if (isAbort(e)) throw e;
        // A server-side error event is final; a transport error is retried.
        if (e instanceof Error && !/network|fetch|load failed|timed out|body/i.test(e.message)) throw e;
      }
    }
    return false;
  }, [agentUrl, consume, token]);

  const finish = useCallback((accumulated: ReturnType<typeof createAccumulator>, conv: { id?: string }): StreamResult => {
    flushSync(() => {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        reconnecting: false,
        content: '',
        thoughts: [],
        parts: [],
        citations: [],
        agentName: undefined,
        interimMessages: [],
      }));
    });
    abortControllerRef.current = null;
    return {
      content: stripThinkTags(accumulated.fullContent),
      thoughts: accumulated.thoughts,
      parts: accumulated.parts,
      citations: Array.from(accumulated.citationsByFileId.values()),
      agentName: accumulated.agentName,
      interimMessages: accumulated.interimMessages,
      conversationId: conv.id,
      turnId: turnRef.current.turnId,
      status: turnRef.current.status,
    };
  }, []);

  const sendMessage = useCallback(async (
    request: ChatMessageRequest,
  ): Promise<StreamResult> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    turnRef.current = { finished: false };

    const accumulated = createAccumulator();
    const conv = { id: request.conversation_id };
    resetForNewStream(request.conversation_id);

    try {
      try {
        await consume(streamChatMessageAgentic(request, { token, agentUrl, signal: controller.signal }), accumulated, conv);
      } catch (e) {
        if (isAbort(e) || turnRef.current.finished || !turnRef.current.turnId) throw e;
        // The turn is still running on the server; the stream is what broke.
        const recovered = await reattach(accumulated, conv, controller.signal);
        if (!recovered) throw e;
      }
    } finally {
      // finish() below resets state; guard against a stale controller.
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
    return finish(accumulated, conv);
  }, [agentUrl, consume, finish, reattach, resetForNewStream, token]);

  /**
   * Attach to a turn that is already running (page reload, returning from
   * sleep). Replays its history from `afterId` (or the start), then follows it
   * to completion. Resolves like `sendMessage`.
   */
  const resumeTurn = useCallback(async (turnId: string, conversationId?: string, afterId?: string): Promise<StreamResult> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    turnRef.current = { turnId, lastEventId: afterId, finished: false };

    const accumulated = createAccumulator();
    const conv = { id: conversationId };
    resetForNewStream(conversationId);
    flushSync(() => setState(prev => ({ ...prev, turnId })));

    try {
      try {
        await consume(streamTurn(turnId, afterId, { token, agentUrl, signal: controller.signal }), accumulated, conv);
      } catch (e) {
        if (isAbort(e) || turnRef.current.finished) throw e;
        const recovered = await reattach(accumulated, conv, controller.signal);
        if (!recovered) throw e;
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
    return finish(accumulated, conv);
  }, [agentUrl, consume, finish, reattach, resetForNewStream, token]);

  /** Stop: tells the server to end the turn (partial output is kept), then drops the stream. */
  const cancel = useCallback(() => {
    const turnId = turnRef.current.turnId;
    if (turnId && !turnRef.current.finished) {
      stopTurn(turnId, { token, agentUrl }).catch(() => undefined);
    }
    abortControllerRef.current?.abort();
  }, [agentUrl, token]);

  const resetPrompt = useCallback(() => {
    setState(prev => ({ ...prev, quickReplies: [], promptActive: false }));
  }, []);

  return {
    state,
    sendMessage,
    resumeTurn,
    cancel,
    resetPrompt,
  };
}
