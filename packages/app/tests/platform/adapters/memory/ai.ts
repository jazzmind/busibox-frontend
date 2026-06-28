import type { ZodSchema } from 'zod';
import type {
  AIAdapter,
  StreamEvent,
  Message,
  AgentDefinition,
  ModelInfo,
} from '../../../../src/platform/interfaces/ai';

/**
 * In-memory AI adapter for testing.
 * Returns deterministic responses so tests don't depend on external services.
 */
export class MemoryAIAdapter implements AIAdapter {
  /** Customise what streamChat returns for testing */
  private _responseText = 'Hello from MemoryAIAdapter. My name is TestBot.';
  private _agents: Map<string, AgentDefinition> = new Map();

  setResponseText(text: string): void {
    this._responseText = text;
  }

  async streamChat(params: {
    messages: Message[];
    agent?: string;
    model?: string;
    systemPrompt?: string;
  }): Promise<ReadableStream<StreamEvent>> {
    // Simulate error for a bad model
    if (params.model === 'nonexistent-model-xyz') {
      return new ReadableStream<StreamEvent>({
        start(controller) {
          controller.enqueue({ type: 'error', error: 'Model not found: nonexistent-model-xyz' });
          controller.enqueue({ type: 'done' });
          controller.close();
        },
      });
    }

    const responseText = this._responseText;
    // If a system prompt instructs a specific name, try to use it
    const match = params.systemPrompt?.match(/named\s+(\w+)/i);
    const effectiveName = match ? match[1] : null;
    const text = effectiveName ? `Hi, I am ${effectiveName}.` : responseText;

    const words = text.split(' ');

    return new ReadableStream<StreamEvent>({
      start(controller) {
        for (const word of words) {
          controller.enqueue({ type: 'text-delta', content: word + ' ' });
        }
        controller.enqueue({
          type: 'done',
          usage: { inputTokens: 10, outputTokens: words.length },
        });
        controller.close();
      },
    });
  }

  async invoke<T>(params: {
    agent?: string;
    input: Record<string, unknown>;
    responseSchema: ZodSchema<T>;
    model?: string;
  }): Promise<T> {
    // Build a minimal valid response that satisfies common schemas.
    // Zod v4: _def.shape is a plain object (not a getter function).
    const schemaDef = (params.responseSchema as any)._def;
    const shape: Record<string, unknown> | undefined =
      typeof schemaDef?.shape === 'function'
        ? schemaDef.shape()                // Zod v3 compat
        : schemaDef?.shape ?? schemaDef?.typeDef?.shape; // Zod v4

    const result: Record<string, unknown> = {};

    if (shape && typeof shape === 'object') {
      for (const [key, def] of Object.entries(shape)) {
        const typeName =
          (def as any)?._def?.typeName ??
          (def as any)?._zod?.typeName ??
          (def as any)?._def?.type;
        if (typeName === 'ZodString' || typeName === 'string') {
          result[key] = 'memory-response';
        } else if (typeName === 'ZodNumber' || typeName === 'number') {
          result[key] = 0.9;
        } else if (typeName === 'ZodBoolean' || typeName === 'boolean') {
          result[key] = true;
        } else {
          result[key] = 'memory-response';
        }
      }
    } else {
      result['response'] = 'memory-response';
    }

    return params.responseSchema.parse(result) as T;
  }

  async syncAgents(definitions: AgentDefinition[]): Promise<void> {
    for (const def of definitions) {
      this._agents.set(def.name, def);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'memory-model',
        name: 'Memory Model',
        provider: 'memory',
        capabilities: ['chat', 'structured'],
      },
    ];
  }

  getRegisteredAgents(): Map<string, AgentDefinition> {
    return this._agents;
  }
}
