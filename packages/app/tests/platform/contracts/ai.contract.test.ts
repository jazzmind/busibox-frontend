import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import type { AIAdapter } from '../../../src/platform/interfaces/ai';
import { collectStream, streamToText, getDoneEvent } from '../helpers/stream';
import { MemoryAIAdapter } from '../adapters/memory/ai';

export function runAIContractTests(getAdapter: () => AIAdapter): void {
  let adapter: AIAdapter;

  beforeEach(() => {
    adapter = getAdapter();
  });

  describe('streamChat', () => {
    it('returns a ReadableStream', async () => {
      const stream = await adapter.streamChat({
        messages: [{ role: 'user', content: 'Say hello' }],
      });
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('emits text-delta events followed by a done event', async () => {
      const stream = await adapter.streamChat({
        messages: [{ role: 'user', content: 'Say the word "test"' }],
      });
      const events = await collectStream(stream);
      const types = events.map((e) => e.type);
      expect(types).toContain('text-delta');
      expect(types[types.length - 1]).toBe('done');
    });

    it('produces non-empty text content', async () => {
      const stream = await adapter.streamChat({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      const events = await collectStream(stream);
      const text = streamToText(events);
      expect(text.trim().length).toBeGreaterThan(0);
    });

    it('respects systemPrompt', async () => {
      const stream = await adapter.streamChat({
        messages: [{ role: 'user', content: 'What is your name?' }],
        systemPrompt: 'You are a bot named TestBot. Always introduce yourself as TestBot.',
      });
      const events = await collectStream(stream);
      const text = streamToText(events);
      expect(text.toLowerCase()).toContain('testbot');
    });

    it('includes usage in the done event', async () => {
      const stream = await adapter.streamChat({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      const events = await collectStream(stream);
      const done = getDoneEvent(events);
      expect(done).toBeDefined();
      expect(done!.usage).toBeDefined();
      expect(done!.usage!.inputTokens).toBeGreaterThan(0);
      expect(done!.usage!.outputTokens).toBeGreaterThan(0);
    });

    it('emits error event on invalid model', async () => {
      const stream = await adapter.streamChat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'nonexistent-model-xyz',
      });
      const events = await collectStream(stream);
      expect(events.some((e) => e.type === 'error')).toBe(true);
    });

    it('handles multi-turn conversation', async () => {
      const stream = await adapter.streamChat({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
      });
      const events = await collectStream(stream);
      expect(events.some((e) => e.type === 'text-delta')).toBe(true);
    });
  });

  describe('invoke', () => {
    const SimpleSchema = z.object({
      answer: z.string(),
      confidence: z.number().min(0).max(1),
    });

    it('returns structured output matching the schema', async () => {
      const result = await adapter.invoke({
        input: { question: 'What is 2+2?' },
        responseSchema: SimpleSchema,
      });
      expect(result.answer).toBeDefined();
      expect(typeof result.answer).toBe('string');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('returns output that passes Zod parse without throwing', async () => {
      const result = await adapter.invoke({
        input: { prompt: 'test' },
        responseSchema: SimpleSchema,
      });
      expect(() => SimpleSchema.parse(result)).not.toThrow();
    });

    it('works with agent parameter', async () => {
      const result = await adapter.invoke({
        agent: 'test-agent',
        input: { prompt: 'hello' },
        responseSchema: z.object({ response: z.string() }),
      });
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
    });

    it('works with boolean schema fields', async () => {
      const BoolSchema = z.object({ ok: z.boolean() });
      const result = await adapter.invoke({
        input: { check: 'test' },
        responseSchema: BoolSchema,
      });
      expect(typeof result.ok).toBe('boolean');
    });
  });

  describe('syncAgents (optional)', () => {
    it('syncs agent definitions without error if supported', async () => {
      if (!adapter.syncAgents) return;
      await expect(
        adapter.syncAgents([
          {
            name: 'test-agent',
            displayName: 'Test Agent',
            instructions: 'You are a test agent.',
            tools: [],
          },
        ]),
      ).resolves.not.toThrow();
    });
  });

  describe('listModels (optional)', () => {
    it('returns a list of models if supported', async () => {
      if (!adapter.listModels) return;
      const models = await adapter.listModels();
      expect(Array.isArray(models)).toBe(true);
      if (models.length > 0) {
        expect(models[0]).toHaveProperty('id');
        expect(models[0]).toHaveProperty('provider');
      }
    });
  });
}

// Run against MemoryAIAdapter
describe('MemoryAIAdapter — AI contract', () => {
  const adapter = new MemoryAIAdapter();

  runAIContractTests(() => adapter);
});
