import type { ZodSchema } from 'zod';
import type {
  AIAdapter,
  StreamEvent,
  Message,
  ToolDef,
  AgentDefinition,
  ModelInfo,
} from '../../interfaces/ai';

interface BusiboxAIConfig {
  agentApiUrl?: string;
  getToken: () => Promise<string>;
}

export class BusiboxAIAdapter implements AIAdapter {
  private baseUrl: string;
  private getToken: () => Promise<string>;

  constructor(config: BusiboxAIConfig) {
    this.baseUrl = config.agentApiUrl ?? process.env.AGENT_API_URL ?? 'http://agent-api:8000';
    this.getToken = config.getToken;
  }

  async streamChat(params: {
    messages: Message[];
    agent?: string;
    model?: string;
    tools?: ToolDef[];
    systemPrompt?: string;
  }): Promise<ReadableStream<StreamEvent>> {
    let token: string;
    try {
      token = await this.getToken();
    } catch (err) {
      return this.errorStream(`Failed to acquire token: ${String(err)}`);
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/message/stream`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: this.convertMessages(params.messages),
          agent_name: params.agent,
          model: params.model,
          system_prompt: params.systemPrompt,
          tools: params.tools?.map((t) => t.name),
        }),
      });
    } catch (err) {
      return this.errorStream(`Network error: ${String(err)}`);
    }

    if (!response.ok) {
      return this.errorStream(`Agent API error: ${response.status} ${response.statusText}`);
    }

    return this.transformSSEStream(response.body!);
  }

  async invoke<T>(params: {
    agent?: string;
    input: Record<string, unknown>;
    responseSchema: ZodSchema<T>;
    model?: string;
  }): Promise<T> {
    const token = await this.getToken();

    const response = await fetch(`${this.baseUrl}/runs/invoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_name: params.agent,
        input: params.input,
        response_schema: zodToJsonSchema(params.responseSchema),
        model: params.model,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent API invoke failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return params.responseSchema.parse(data.output ?? data) as T;
  }

  async syncAgents(definitions: AgentDefinition[]): Promise<void> {
    const token = await this.getToken();

    const response = await fetch(`${this.baseUrl}/agents/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agents: definitions }),
    });

    if (!response.ok) {
      throw new Error(`Agent sync failed: ${response.status} ${response.statusText}`);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const token = await this.getToken();

    try {
      const response = await fetch(`${this.baseUrl}/llm/models`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.models ?? []) as ModelInfo[];
    } catch {
      return [];
    }
  }

  // --- Private helpers ---

  private convertMessages(messages: Message[]) {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
      tool_calls: m.toolCalls,
      tool_results: m.toolResults,
    }));
  }

  private transformSSEStream(body: ReadableStream<Uint8Array>): ReadableStream<StreamEvent> {
    const decoder = new TextDecoder();
    let buffer = '';

    return new ReadableStream<StreamEvent>({
      async start(controller) {
        const reader = body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue({ type: 'done' });
              controller.close();
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const payload = line.slice(6).trim();
                if (payload === '[DONE]') continue;
                try {
                  const event = JSON.parse(payload) as Record<string, unknown>;
                  const mapped = mapAgentEvent(event);
                  if (mapped) controller.enqueue(mapped);
                } catch {
                  // Skip malformed SSE lines
                }
              }
            }
          }
        } catch (err) {
          controller.enqueue({ type: 'error', error: String(err) });
          controller.enqueue({ type: 'done' });
          controller.close();
        }
      },
    });
  }

  private errorStream(message: string): ReadableStream<StreamEvent> {
    return new ReadableStream<StreamEvent>({
      start(controller) {
        controller.enqueue({ type: 'error', error: message });
        controller.enqueue({ type: 'done' });
        controller.close();
      },
    });
  }
}

function mapAgentEvent(event: Record<string, unknown>): StreamEvent | null {
  switch (event['type']) {
    case 'content':
    case 'text':
      return { type: 'text-delta', content: (event['text'] ?? event['content']) as string };
    case 'tool_use':
    case 'tool_call':
      return { type: 'tool-call', toolCall: event['tool_call'] as StreamEvent['toolCall'] };
    case 'tool_result':
      return { type: 'tool-result', toolResult: event['tool_result'] as StreamEvent['toolResult'] };
    case 'error':
      return { type: 'error', error: event['message'] as string };
    case 'done':
    case 'end':
      return {
        type: 'done',
        usage: event['usage'] as StreamEvent['usage'],
      };
    default:
      return null;
  }
}

/** Minimal Zod-to-JSON-Schema conversion for agent-api response_schema */
function zodToJsonSchema(schema: ZodSchema): Record<string, unknown> {
  const def = (schema as any)._def as Record<string, unknown>;
  const type = (def['type'] as string) ?? '';

  if (type === 'object' || def['typeName'] === 'ZodObject') {
    const shape = (def['shape'] as Record<string, unknown>) ?? {};
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, fieldSchema] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(fieldSchema as ZodSchema);
      const fieldDef = (fieldSchema as any)._def as Record<string, unknown>;
      const isOptional = fieldDef['typeName'] === 'ZodOptional' || fieldDef['type'] === 'optional';
      if (!isOptional) required.push(key);
    }

    return { type: 'object', properties, required };
  }

  switch (type) {
    case 'string': return { type: 'string' };
    case 'number': return { type: 'number' };
    case 'boolean': return { type: 'boolean' };
    case 'array': return { type: 'array', items: zodToJsonSchema((def['element'] as ZodSchema)) };
    default: return { type: 'string' };
  }
}
