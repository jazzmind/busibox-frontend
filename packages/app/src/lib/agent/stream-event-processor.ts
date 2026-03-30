import { stripThinkTags, extractThinkContent } from '../../components/chat/chat-utils';
import type { ThoughtEvent } from '../../components/chat/ThinkingToggle';
import type { MessagePart } from '../../types/chat';

export interface StreamAccumulator {
  fullContent: string;
  thoughts: ThoughtEvent[];
  parts: MessagePart[];
  pendingTools: Map<string, number>;
  agentName?: string;
  interimMessages: string[];
}

export interface StreamEventResult {
  content?: string;
  thoughts?: ThoughtEvent[];
  parts?: MessagePart[];
  agentName?: string;
  interimMessages?: string[];
  quickReplies?: string[];
  promptActive?: boolean;
  conversationId?: string;
  title?: string;
  titleUpdate?: { id: string; title: string };
  complete?: boolean;
  error?: string;
}

export function createAccumulator(): StreamAccumulator {
  return {
    fullContent: '',
    thoughts: [],
    parts: [],
    pendingTools: new Map<string, number>(),
    agentName: undefined,
    interimMessages: [],
  };
}

/**
 * Pure function that processes a single SSE stream event, mutating the
 * accumulator in place and returning a result object describing what changed.
 *
 * Both ChatInterface and useChatStream call this so streaming behaviour
 * (including live thinking extraction) is defined in exactly one place.
 */
export function processStreamEvent(
  eventType: string,
  parsed: any,
  accumulated: StreamAccumulator,
): StreamEventResult {
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
        // Final marker — no content change
      } else if (msgText) {
        accumulated.fullContent = msgText;
      }

      const thinkTexts = extractThinkContent(accumulated.fullContent);
      if (thinkTexts.length > 0) {
        const thinkThought: ThoughtEvent = {
          type: 'thought',
          source: 'model',
          message: thinkTexts.join('\n\n'),
          data: parsed.data || parsed,
          timestamp: new Date(),
        };
        const hasModelThought = accumulated.thoughts.some(
          t => t.source === 'model' && t.type === 'thought'
        );
        if (hasModelThought) {
          accumulated.thoughts = accumulated.thoughts.map(t =>
            t.source === 'model' && t.type === 'thought' ? thinkThought : t
          );
        } else {
          accumulated.thoughts = [...accumulated.thoughts, thinkThought];
        }
      }

      return {
        content: stripThinkTags(accumulated.fullContent),
        thoughts: accumulated.thoughts,
      };
    }

    case 'content_chunk': {
      accumulated.fullContent += parsed.chunk || parsed.content || '';

      const thinkTexts = extractThinkContent(accumulated.fullContent);
      if (thinkTexts.length > 0) {
        const thinkThought: ThoughtEvent = {
          type: 'thought',
          source: 'model',
          message: thinkTexts.join('\n\n'),
          data: parsed.data || parsed,
          timestamp: new Date(),
        };
        const hasModelThought = accumulated.thoughts.some(
          t => t.source === 'model' && t.type === 'thought'
        );
        if (hasModelThought) {
          accumulated.thoughts = accumulated.thoughts.map(t =>
            t.source === 'model' && t.type === 'thought' ? thinkThought : t
          );
        } else {
          accumulated.thoughts = [...accumulated.thoughts, thinkThought];
        }
      }

      return {
        content: stripThinkTags(accumulated.fullContent),
        thoughts: accumulated.thoughts,
      };
    }

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
}
