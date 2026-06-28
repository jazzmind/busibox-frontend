import type { ZodSchema } from 'zod';
import type {
  AIAdapter,
  StreamEvent,
  Message,
  ToolDef,
  AgentDefinition,
  ModelInfo,
} from '../../interfaces/ai';

interface VercelAIConfig {
  defaultProvider?: 'anthropic' | 'openai';
  anthropicApiKey?: string;
  openaiApiKey?: string;
  models?: {
    fast?: string;
    smart?: string;
  };
}

type SDKMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export class VercelAIAdapter implements AIAdapter {
  private config: Required<Pick<VercelAIConfig, 'defaultProvider' | 'models'>> & VercelAIConfig;

  constructor(config: VercelAIConfig = {}) {
    this.config = {
      defaultProvider: config.defaultProvider ?? 'anthropic',
      models: config.models ?? { fast: 'claude-haiku-4-5', smart: 'claude-sonnet-4-5' },
      ...config,
    };
  }

  async streamChat(params: {
    messages: Message[];
    agent?: string;
    model?: string;
    tools?: ToolDef[];
    systemPrompt?: string;
  }): Promise<ReadableStream<StreamEvent>> {
    try {
      const { streamText } = await this.importAI();
      const model = await this.resolveModel(params.model);

      const result = streamText({
        model,
        messages: this.convertMessages(params.messages),
        system: params.systemPrompt,
      });

      return this.transformAISDKStream(result);
    } catch (err) {
      return this.errorStream(String(err));
    }
  }

  async invoke<T>(params: {
    agent?: string;
    input: Record<string, unknown>;
    responseSchema: ZodSchema<T>;
    model?: string;
  }): Promise<T> {
    const { generateObject } = await this.importAI();
    const model = await this.resolveModel(params.model ?? this.config.models.fast);

    const prompt = JSON.stringify(params.input);

    const { object } = await generateObject({
      model,
      prompt,
      schema: params.responseSchema,
    });

    return object as T;
  }

  async listModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];

    if (this.config.defaultProvider === 'anthropic') {
      models.push(
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', capabilities: ['chat', 'structured', 'tools'] },
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'anthropic', capabilities: ['chat', 'structured', 'tools', 'vision'] },
      );
    } else if (this.config.defaultProvider === 'openai') {
      models.push(
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', capabilities: ['chat', 'structured', 'tools'] },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', capabilities: ['chat', 'structured', 'tools', 'vision'] },
      );
    }

    return models;
  }

  // --- Private helpers ---

  private async importAI() {
    try {
      return await import('ai');
    } catch {
      throw new Error(
        'Vercel AI adapter requires the "ai" package. Run: pnpm add ai @ai-sdk/anthropic',
      );
    }
  }

  private async resolveModel(modelId?: string) {
    const effectiveModel = modelId ?? this.config.models.fast ?? 'claude-haiku-4-5';

    if (this.config.defaultProvider === 'openai') {
      const { openai } = await importOpenAI(this.config.openaiApiKey);
      return openai(effectiveModel);
    }

    const { anthropic } = await importAnthropic(this.config.anthropicApiKey);
    return anthropic(effectiveModel);
  }

  private convertMessages(messages: Message[]): SDKMessage[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  private transformAISDKStream(result: { fullStream: AsyncIterable<unknown> }): ReadableStream<StreamEvent> {
    return new ReadableStream<StreamEvent>({
      async start(controller) {
        let inputTokens = 0;
        let outputTokens = 0;

        try {
          for await (const part of result.fullStream) {
            const p = part as Record<string, unknown>;
            switch (p['type']) {
              case 'text-delta':
                controller.enqueue({ type: 'text-delta', content: p['textDelta'] as string });
                break;
              case 'tool-call':
                controller.enqueue({
                  type: 'tool-call',
                  toolCall: {
                    id: p['toolCallId'] as string,
                    name: p['toolName'] as string,
                    args: p['args'] as Record<string, unknown>,
                  },
                });
                break;
              case 'tool-result':
                controller.enqueue({
                  type: 'tool-result',
                  toolResult: {
                    id: p['toolCallId'] as string,
                    result: p['result'],
                  },
                });
                break;
              case 'finish': {
                const usage = p['usage'] as { promptTokens?: number; completionTokens?: number } | undefined;
                inputTokens = usage?.promptTokens ?? 0;
                outputTokens = usage?.completionTokens ?? 0;
                break;
              }
              case 'error':
                controller.enqueue({ type: 'error', error: String(p['error']) });
                break;
            }
          }
          controller.enqueue({ type: 'done', usage: { inputTokens, outputTokens } });
          controller.close();
        } catch (err) {
          controller.enqueue({ type: 'error', error: String(err) });
          controller.enqueue({ type: 'done', usage: { inputTokens, outputTokens } });
          controller.close();
        }
      },
    });
  }

  private errorStream(message: string): ReadableStream<StreamEvent> {
    return new ReadableStream<StreamEvent>({
      start(controller) {
        controller.enqueue({ type: 'error', error: message });
        controller.enqueue({ type: 'done', usage: { inputTokens: 0, outputTokens: 0 } });
        controller.close();
      },
    });
  }
}

async function importAnthropic(apiKey?: string) {
  try {
    const { createAnthropic } = await import('@ai-sdk/anthropic');
    return { anthropic: createAnthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY }) };
  } catch {
    throw new Error(
      'Vercel AI adapter requires "@ai-sdk/anthropic". Run: pnpm add @ai-sdk/anthropic',
    );
  }
}

async function importOpenAI(apiKey?: string) {
  try {
    const { createOpenAI } = await import('@ai-sdk/openai');
    return { openai: createOpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY }) };
  } catch {
    throw new Error(
      'Vercel AI adapter requires "@ai-sdk/openai". Run: pnpm add @ai-sdk/openai',
    );
  }
}
