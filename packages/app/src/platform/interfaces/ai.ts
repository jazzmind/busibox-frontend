import type { ZodSchema } from 'zod';

export interface StreamEvent {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'error' | 'done';
  /** Incremental text chunk (type=text-delta) */
  content?: string;
  /** Tool call metadata (type=tool-call) */
  toolCall?: { id: string; name: string; args: Record<string, unknown> };
  /** Tool result (type=tool-result) */
  toolResult?: { id: string; result: unknown };
  /** Error message (type=error) */
  error?: string;
  /** Usage stats (type=done) */
  usage?: { inputTokens: number; outputTokens: number };
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  toolResults?: Array<{ id: string; result: unknown }>;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: ZodSchema;
}

export interface AgentDefinition {
  name: string;
  displayName: string;
  instructions: string;
  model?: string;
  tools?: string[];
  scopes?: string[];
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: ('chat' | 'structured' | 'vision' | 'tools')[];
}

export interface AIAdapter {
  streamChat(params: {
    messages: Message[];
    agent?: string;
    model?: string;
    tools?: ToolDef[];
    systemPrompt?: string;
  }): Promise<ReadableStream<StreamEvent>>;

  invoke<T>(params: {
    agent?: string;
    input: Record<string, unknown>;
    responseSchema: ZodSchema<T>;
    model?: string;
  }): Promise<T>;

  syncAgents?(definitions: AgentDefinition[]): Promise<void>;
  listModels?(): Promise<ModelInfo[]>;
}
