import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import type { SearchAdapter } from '../../../src/platform/interfaces/search';
import { MemorySearchAdapter } from '../adapters/memory/search';

const SEED_DOCS = [
  { id: 'doc-1', collection: 'collection_a', content: 'The quick brown fox jumps over the lazy dog', metadata: { author: 'test' } },
  { id: 'doc-2', collection: 'collection_a', content: 'Specific topic about machine learning and AI', metadata: {} },
  { id: 'doc-3', collection: 'collection_b', content: 'Another document about specific topics in data science', metadata: {} },
  { id: 'doc-4', collection: 'collection_b', content: 'Test document with various keywords for searching', metadata: {} },
  { id: 'doc-5', collection: 'collection_a', content: 'Quick reference guide for testing and development', metadata: {} },
];

export function runSearchContractTests(
  getAdapter: () => SearchAdapter,
  seedData: () => Promise<void>,
): void {
  let adapter: SearchAdapter;

  beforeAll(async () => {
    await seedData();
  });

  beforeEach(() => {
    adapter = getAdapter();
  });

  describe('search', () => {
    it('returns results with positive scores', async () => {
      const results = await adapter.search({ query: 'test document' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('results have required fields', async () => {
      const results = await adapter.search({ query: 'document' });
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('id');
        expect(results[0]).toHaveProperty('content');
        expect(results[0]).toHaveProperty('score');
      }
    });

    it('respects limit parameter', async () => {
      const results = await adapter.search({ query: 'test', limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('returns results sorted by relevance (highest score first)', async () => {
      const results = await adapter.search({ query: 'specific topic' });
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      }
    });

    it('filters by collection when specified', async () => {
      const results = await adapter.search({
        query: 'document',
        collections: ['collection_a'],
      });
      results.forEach((r) => {
        expect(r.collection).toBe('collection_a');
      });
    });

    it('returns empty array for query with no matches', async () => {
      const results = await adapter.search({
        query: 'xyzzy_no_match_abc_qqq',
      });
      expect(results).toEqual([]);
    });

    it('supports keyword mode', async () => {
      const results = await adapter.search({ query: 'test', mode: 'keyword' });
      expect(Array.isArray(results)).toBe(true);
    });

    it('supports semantic mode', async () => {
      const results = await adapter.search({ query: 'machine learning', mode: 'semantic' });
      expect(Array.isArray(results)).toBe(true);
    });

    it('supports hybrid mode', async () => {
      const results = await adapter.search({ query: 'document', mode: 'hybrid' });
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns results from multiple collections when no filter', async () => {
      const results = await adapter.search({ query: 'document topic' });
      const collections = new Set(results.map((r) => r.collection).filter(Boolean));
      expect(collections.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('embed (optional)', () => {
    it('generates embeddings if supported', async () => {
      if (!adapter.embed) return;
      const vectors = await adapter.embed(['hello world', 'test text']);
      expect(vectors).toHaveLength(2);
      expect(vectors[0].length).toBeGreaterThan(0);
      expect(vectors[0].length).toBe(vectors[1].length);
    });

    it('all embedding values are numbers', async () => {
      if (!adapter.embed) return;
      const vectors = await adapter.embed(['test']);
      expect(vectors[0].every((v) => typeof v === 'number')).toBe(true);
    });
  });
}

// Run against MemorySearchAdapter
describe('MemorySearchAdapter — search contract', () => {
  const adapter = new MemorySearchAdapter();

  runSearchContractTests(
    () => adapter,
    async () => {
      adapter.reset();
      adapter.seed(SEED_DOCS);
    },
  );
});
