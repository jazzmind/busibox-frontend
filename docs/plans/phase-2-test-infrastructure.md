# Phase 2: Test Infrastructure & Contract Tests

## Objective

Build a comprehensive test harness for the platform abstraction layer. Tests define the **contract** that all adapters must satisfy — written before adapters are implemented (TDD). This ensures every platform behaves identically from a consuming app's perspective and catches regressions when adapters are updated.

## Gate condition

- Test suite runs via `pnpm test` in `packages/app`
- Contract test suite defines 50+ test cases across AI, Data, Search, Storage, and Auth interfaces
- A "null adapter" (in-memory mock) passes all contract tests — proving the test harness works
- Test fixtures provide deterministic data for all services
- CI pipeline runs contract tests against each registered adapter

---

## 2.1 Test setup (`packages/app/tests/`)

```
packages/app/tests/
├── setup.ts                      # Vitest global setup
├── helpers/
│   ├── fixtures.ts               # Shared test data builders
│   ├── stream.ts                 # ReadableStream test utilities
│   └── env.ts                    # Environment variable helpers for tests
├── contracts/
│   ├── ai.contract.test.ts       # AIAdapter contract tests
│   ├── data.contract.test.ts     # DataAdapter contract tests
│   ├── search.contract.test.ts   # SearchAdapter contract tests
│   ├── storage.contract.test.ts  # StorageAdapter contract tests
│   └── auth.contract.test.ts     # AuthAdapter contract tests
├── adapters/
│   ├── memory/                   # In-memory reference adapter (for test harness validation)
│   │   ├── index.ts
│   │   ├── ai.ts
│   │   ├── data.ts
│   │   ├── search.ts
│   │   ├── storage.ts
│   │   └── auth.ts
│   ├── busibox/                  # Busibox adapter integration tests
│   │   ├── ai.integration.test.ts
│   │   ├── data.integration.test.ts
│   │   ├── search.integration.test.ts
│   │   └── storage.integration.test.ts
│   └── vercel/                   # Vercel adapter integration tests
│       ├── ai.integration.test.ts
│       ├── data.integration.test.ts
│       ├── search.integration.test.ts
│       └── storage.integration.test.ts
├── platform/
│   ├── config.test.ts            # Platform detection tests
│   ├── factory.test.ts           # Platform factory tests
│   └── registry.test.ts         # Adapter registration tests
└── vitest.config.ts              # Test configuration
```

---

## 2.2 Vitest configuration

```typescript
// packages/app/tests/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./setup.ts'],
    include: [
      'contracts/**/*.test.ts',
      'platform/**/*.test.ts',
      'adapters/memory/**/*.test.ts',
    ],
    // Integration tests run separately — they need real services
    exclude: ['adapters/busibox/**', 'adapters/vercel/**'],
    coverage: {
      include: ['../src/platform/**'],
      thresholds: { statements: 90, branches: 85, functions: 90 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '../src') },
  },
});
```

Separate integration config:

```typescript
// packages/app/tests/vitest.integration.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./setup.ts'],
    include: ['adapters/**/*.integration.test.ts'],
    testTimeout: 30_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '../src') },
  },
});
```

---

## 2.3 Contract test pattern

Each contract test file exports a **test factory** that accepts an adapter instance. This allows the same tests to run against ANY adapter implementation.

### Data adapter contract (`contracts/data.contract.test.ts`)

```typescript
import type { DataAdapter, CollectionSchema } from '../../src/platform/interfaces/data';

const TEST_COLLECTION = 'test_items';
const TEST_SCHEMA: CollectionSchema = {
  fields: [
    { name: 'id', type: 'uuid', primaryKey: true },
    { name: 'title', type: 'text' },
    { name: 'count', type: 'integer', nullable: true },
    { name: 'active', type: 'boolean', default: true },
    { name: 'created_at', type: 'timestamp' },
    { name: 'metadata', type: 'json', nullable: true },
  ],
};

export function runDataContractTests(getAdapter: () => DataAdapter) {
  let adapter: DataAdapter;

  beforeEach(() => {
    adapter = getAdapter();
  });

  describe('ensureCollection', () => {
    it('creates a collection without error', async () => {
      await expect(adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA)).resolves.not.toThrow();
    });

    it('is idempotent — calling twice does not error', async () => {
      await adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA);
      await expect(adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA)).resolves.not.toThrow();
    });
  });

  describe('insert', () => {
    beforeEach(async () => {
      await adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA);
    });

    it('inserts a single record and returns its ID', async () => {
      const ids = await adapter.insert(TEST_COLLECTION, [{
        title: 'Item 1',
        count: 5,
        active: true,
        created_at: new Date().toISOString(),
      }]);
      expect(ids).toHaveLength(1);
      expect(typeof ids[0]).toBe('string');
    });

    it('inserts multiple records', async () => {
      const ids = await adapter.insert(TEST_COLLECTION, [
        { title: 'A', count: 1, active: true, created_at: new Date().toISOString() },
        { title: 'B', count: 2, active: false, created_at: new Date().toISOString() },
        { title: 'C', count: 3, active: true, created_at: new Date().toISOString() },
      ]);
      expect(ids).toHaveLength(3);
    });

    it('auto-generates UUID if id field not provided', async () => {
      const ids = await adapter.insert(TEST_COLLECTION, [{ title: 'No ID', count: 0, created_at: new Date().toISOString() }]);
      expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('get', () => {
    let insertedId: string;

    beforeEach(async () => {
      await adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA);
      const ids = await adapter.insert(TEST_COLLECTION, [{ title: 'Findme', count: 42, created_at: new Date().toISOString() }]);
      insertedId = ids[0];
    });

    it('retrieves a record by ID', async () => {
      const record = await adapter.get(TEST_COLLECTION, insertedId);
      expect(record).not.toBeNull();
      expect(record!.title).toBe('Findme');
      expect(record!.count).toBe(42);
    });

    it('returns null for non-existent ID', async () => {
      const record = await adapter.get(TEST_COLLECTION, '00000000-0000-0000-0000-000000000000');
      expect(record).toBeNull();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA);
      await adapter.insert(TEST_COLLECTION, [
        { title: 'Alpha', count: 10, active: true, created_at: '2024-01-01T00:00:00Z' },
        { title: 'Beta', count: 20, active: false, created_at: '2024-01-02T00:00:00Z' },
        { title: 'Gamma', count: 30, active: true, created_at: '2024-01-03T00:00:00Z' },
        { title: 'Delta', count: 40, active: true, created_at: '2024-01-04T00:00:00Z' },
        { title: 'Epsilon', count: 50, active: false, created_at: '2024-01-05T00:00:00Z' },
      ]);
    });

    it('returns all records when no filters', async () => {
      const result = await adapter.query(TEST_COLLECTION);
      expect(result.records).toHaveLength(5);
      expect(result.total).toBe(5);
    });

    it('filters with eq operator', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'active', op: 'eq', value: true }],
      });
      expect(result.records).toHaveLength(3);
      expect(result.records.every((r: any) => r.active === true)).toBe(true);
    });

    it('filters with gt operator', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'count', op: 'gt', value: 25 }],
      });
      expect(result.records).toHaveLength(3);
    });

    it('filters with in operator', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'title', op: 'in', value: ['Alpha', 'Gamma'] }],
      });
      expect(result.records).toHaveLength(2);
    });

    it('applies multiple filters (AND)', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [
          { field: 'active', op: 'eq', value: true },
          { field: 'count', op: 'gte', value: 30 },
        ],
      });
      expect(result.records).toHaveLength(2);
    });

    it('sorts ascending', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        sort: [{ field: 'count', direction: 'asc' }],
      });
      const counts = result.records.map((r: any) => r.count);
      expect(counts).toEqual([10, 20, 30, 40, 50]);
    });

    it('sorts descending', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        sort: [{ field: 'count', direction: 'desc' }],
      });
      const counts = result.records.map((r: any) => r.count);
      expect(counts).toEqual([50, 40, 30, 20, 10]);
    });

    it('applies limit', async () => {
      const result = await adapter.query(TEST_COLLECTION, { limit: 2 });
      expect(result.records).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('applies offset', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        sort: [{ field: 'count', direction: 'asc' }],
        limit: 2,
        offset: 2,
      });
      expect(result.records).toHaveLength(2);
      expect((result.records[0] as any).title).toBe('Gamma');
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA);
      await adapter.insert(TEST_COLLECTION, [
        { title: 'ToUpdate', count: 1, active: true, created_at: new Date().toISOString() },
        { title: 'ToUpdate', count: 2, active: true, created_at: new Date().toISOString() },
        { title: 'DontTouch', count: 3, active: false, created_at: new Date().toISOString() },
      ]);
    });

    it('updates matching records and returns count', async () => {
      const count = await adapter.update(
        TEST_COLLECTION,
        [{ field: 'title', op: 'eq', value: 'ToUpdate' }],
        { active: false },
      );
      expect(count).toBe(2);
    });

    it('returns 0 when no records match', async () => {
      const count = await adapter.update(
        TEST_COLLECTION,
        [{ field: 'title', op: 'eq', value: 'NonExistent' }],
        { active: false },
      );
      expect(count).toBe(0);
    });

    it('verifies updated data persists', async () => {
      await adapter.update(
        TEST_COLLECTION,
        [{ field: 'count', op: 'eq', value: 1 }],
        { title: 'Updated!' },
      );
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'count', op: 'eq', value: 1 }],
      });
      expect((result.records[0] as any).title).toBe('Updated!');
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA);
      await adapter.insert(TEST_COLLECTION, [
        { title: 'Keep', count: 1, active: true, created_at: new Date().toISOString() },
        { title: 'Remove', count: 2, active: false, created_at: new Date().toISOString() },
        { title: 'Remove', count: 3, active: false, created_at: new Date().toISOString() },
      ]);
    });

    it('deletes matching records and returns count', async () => {
      const count = await adapter.delete(TEST_COLLECTION, [{ field: 'active', op: 'eq', value: false }]);
      expect(count).toBe(2);
    });

    it('does not delete non-matching records', async () => {
      await adapter.delete(TEST_COLLECTION, [{ field: 'active', op: 'eq', value: false }]);
      const result = await adapter.query(TEST_COLLECTION);
      expect(result.total).toBe(1);
      expect((result.records[0] as any).title).toBe('Keep');
    });
  });
}
```

### AI adapter contract (`contracts/ai.contract.test.ts`)

```typescript
import type { AIAdapter, StreamEvent } from '../../src/platform/interfaces/ai';
import { z } from 'zod';
import { collectStream } from '../helpers/stream';

export function runAIContractTests(getAdapter: () => AIAdapter) {
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
      const types = events.map(e => e.type);
      expect(types).toContain('text-delta');
      expect(types[types.length - 1]).toBe('done');
    });

    it('respects systemPrompt', async () => {
      const stream = await adapter.streamChat({
        messages: [{ role: 'user', content: 'What is your name?' }],
        systemPrompt: 'You are a bot named TestBot. Always introduce yourself as TestBot.',
      });
      const events = await collectStream(stream);
      const text = events
        .filter(e => e.type === 'text-delta')
        .map(e => e.content)
        .join('');
      expect(text.toLowerCase()).toContain('testbot');
    });

    it('includes usage in the done event', async () => {
      const stream = await adapter.streamChat({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      const events = await collectStream(stream);
      const done = events.find(e => e.type === 'done');
      expect(done?.usage).toBeDefined();
      expect(done!.usage!.inputTokens).toBeGreaterThan(0);
      expect(done!.usage!.outputTokens).toBeGreaterThan(0);
    });

    it('emits error event on invalid model', async () => {
      const stream = await adapter.streamChat({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'nonexistent-model-xyz',
      });
      const events = await collectStream(stream);
      expect(events.some(e => e.type === 'error')).toBe(true);
    });
  });

  describe('invoke', () => {
    const TestSchema = z.object({
      answer: z.string(),
      confidence: z.number().min(0).max(1),
    });

    it('returns structured output matching the schema', async () => {
      const result = await adapter.invoke({
        input: { question: 'What is 2+2?' },
        responseSchema: TestSchema,
      });
      expect(result.answer).toBeDefined();
      expect(typeof result.answer).toBe('string');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('respects agent parameter when provided', async () => {
      // This test verifies the agent routing works — the memory adapter
      // should route to a named handler if configured
      const result = await adapter.invoke({
        agent: 'test-agent',
        input: { prompt: 'hello' },
        responseSchema: z.object({ response: z.string() }),
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('syncAgents (optional)', () => {
    it('syncs agent definitions without error if supported', async () => {
      if (!adapter.syncAgents) return;
      await expect(adapter.syncAgents([{
        name: 'test-agent',
        displayName: 'Test Agent',
        instructions: 'You are a test agent.',
        tools: [],
      }])).resolves.not.toThrow();
    });
  });
}
```

### Search adapter contract (`contracts/search.contract.test.ts`)

```typescript
import type { SearchAdapter } from '../../src/platform/interfaces/search';

export function runSearchContractTests(
  getAdapter: () => SearchAdapter,
  seedData: () => Promise<void>,
) {
  let adapter: SearchAdapter;

  beforeAll(async () => {
    await seedData();
  });

  beforeEach(() => {
    adapter = getAdapter();
  });

  describe('search', () => {
    it('returns results with scores', async () => {
      const results = await adapter.search({ query: 'test document' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].content).toBeDefined();
      expect(results[0].id).toBeDefined();
    });

    it('respects limit parameter', async () => {
      const results = await adapter.search({ query: 'test', limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('returns results sorted by relevance (highest score first)', async () => {
      const results = await adapter.search({ query: 'specific topic' });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('filters by collection when specified', async () => {
      const results = await adapter.search({
        query: 'test',
        collections: ['collection_a'],
      });
      expect(results.every(r => r.collection === 'collection_a')).toBe(true);
    });

    it('supports keyword mode', async () => {
      const results = await adapter.search({ query: 'exact phrase match', mode: 'keyword' });
      expect(results).toBeDefined();
    });

    it('supports semantic mode', async () => {
      const results = await adapter.search({ query: 'conceptually similar content', mode: 'semantic' });
      expect(results).toBeDefined();
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
  });
}
```

### Storage adapter contract (`contracts/storage.contract.test.ts`)

```typescript
import type { StorageAdapter } from '../../src/platform/interfaces/storage';

export function runStorageContractTests(getAdapter: () => StorageAdapter) {
  let adapter: StorageAdapter;

  beforeEach(() => {
    adapter = getAdapter();
  });

  describe('upload + download cycle', () => {
    it('uploads a file and returns id + url', async () => {
      const content = Buffer.from('Hello, world!');
      const result = await adapter.upload(content, {
        filename: 'test.txt',
        contentType: 'text/plain',
      });
      expect(result.id).toBeDefined();
      expect(result.url).toBeDefined();
      expect(result.size).toBe(content.length);
      expect(result.contentType).toBe('text/plain');
    });

    it('downloads the uploaded file with matching content', async () => {
      const content = Buffer.from('Download test content');
      const { id } = await adapter.upload(content, { filename: 'download-test.txt' });
      const stream = await adapter.download(id);
      const chunks: Uint8Array[] = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const downloaded = Buffer.concat(chunks).toString();
      expect(downloaded).toBe('Download test content');
    });
  });

  describe('delete', () => {
    it('deletes an uploaded file', async () => {
      const { id } = await adapter.upload(Buffer.from('delete me'), { filename: 'del.txt' });
      await expect(adapter.delete(id)).resolves.not.toThrow();
    });

    it('download after delete throws or returns empty', async () => {
      const { id } = await adapter.upload(Buffer.from('gone'), { filename: 'gone.txt' });
      await adapter.delete(id);
      await expect(adapter.download(id)).rejects.toThrow();
    });
  });

  describe('getUrl', () => {
    it('returns a URL string for an uploaded file', async () => {
      const { id } = await adapter.upload(Buffer.from('url test'), { filename: 'url.txt' });
      const url = await adapter.getUrl(id);
      expect(url).toMatch(/^https?:\/\//);
    });
  });

  describe('visibility', () => {
    it('respects public visibility', async () => {
      const { url } = await adapter.upload(Buffer.from('public'), {
        filename: 'public.txt',
        visibility: 'public',
      });
      expect(url).toBeDefined();
    });

    it('respects private visibility', async () => {
      const { id } = await adapter.upload(Buffer.from('private'), {
        filename: 'private.txt',
        visibility: 'private',
      });
      const url = await adapter.getUrl(id, { expiresIn: 3600 });
      expect(url).toBeDefined();
    });
  });
}
```

---

## 2.4 In-memory reference adapter (`tests/adapters/memory/`)

A fully in-memory adapter that passes all contract tests. Used to validate the test harness itself and as a development/testing platform.

```typescript
// tests/adapters/memory/data.ts
import type { DataAdapter, CollectionSchema, Filter, QueryResult, SortField } from '../../../src/platform/interfaces/data';
import { randomUUID } from 'crypto';

export class MemoryDataAdapter implements DataAdapter {
  private collections: Map<string, {
    schema: CollectionSchema;
    records: Map<string, Record<string, unknown>>;
  }> = new Map();

  async ensureCollection(collection: string, schema: CollectionSchema): Promise<void> {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, { schema, records: new Map() });
    }
  }

  async insert(collection: string, records: Record<string, unknown>[]): Promise<string[]> {
    const col = this.getCollection(collection);
    const ids: string[] = [];
    for (const record of records) {
      const id = (record.id as string) || randomUUID();
      col.records.set(id, { ...record, id });
      ids.push(id);
    }
    return ids;
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const col = this.collections.get(collection);
    if (!col) return null;
    return (col.records.get(id) as T) ?? null;
  }

  async query<T>(collection: string, params?: {
    filters?: Filter[];
    sort?: SortField[];
    limit?: number;
    offset?: number;
  }): Promise<QueryResult<T>> {
    const col = this.getCollection(collection);
    let records = Array.from(col.records.values());

    if (params?.filters) {
      records = records.filter(r => params.filters!.every(f => this.matchFilter(r, f)));
    }
    const total = records.length;
    if (params?.sort) {
      records = this.sortRecords(records, params.sort);
    }
    if (params?.offset) records = records.slice(params.offset);
    if (params?.limit) records = records.slice(0, params.limit);

    return { records: records as T[], total };
  }

  async update(collection: string, filters: Filter[], data: Record<string, unknown>): Promise<number> {
    const col = this.getCollection(collection);
    let count = 0;
    for (const [id, record] of col.records) {
      if (filters.every(f => this.matchFilter(record, f))) {
        col.records.set(id, { ...record, ...data });
        count++;
      }
    }
    return count;
  }

  async delete(collection: string, filters: Filter[]): Promise<number> {
    const col = this.getCollection(collection);
    let count = 0;
    for (const [id, record] of col.records) {
      if (filters.every(f => this.matchFilter(record, f))) {
        col.records.delete(id);
        count++;
      }
    }
    return count;
  }

  /** Reset all data (for tests) */
  reset(): void { this.collections.clear(); }

  private getCollection(name: string) {
    const col = this.collections.get(name);
    if (!col) throw new Error(`Collection "${name}" not found. Call ensureCollection first.`);
    return col;
  }

  private matchFilter(record: Record<string, unknown>, filter: Filter): boolean {
    const value = record[filter.field];
    switch (filter.op) {
      case 'eq': return value === filter.value;
      case 'neq': return value !== filter.value;
      case 'gt': return (value as number) > (filter.value as number);
      case 'gte': return (value as number) >= (filter.value as number);
      case 'lt': return (value as number) < (filter.value as number);
      case 'lte': return (value as number) <= (filter.value as number);
      case 'in': return (filter.value as unknown[]).includes(value);
      case 'contains': return String(value).includes(String(filter.value));
      case 'startsWith': return String(value).startsWith(String(filter.value));
      default: return false;
    }
  }

  private sortRecords(records: Record<string, unknown>[], sorts: SortField[]) {
    return [...records].sort((a, b) => {
      for (const s of sorts) {
        const av = a[s.field] as any, bv = b[s.field] as any;
        if (av < bv) return s.direction === 'asc' ? -1 : 1;
        if (av > bv) return s.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
}
```

---

## 2.5 Stream test utilities

```typescript
// tests/helpers/stream.ts
import type { StreamEvent } from '../../src/platform/interfaces/ai';

export async function collectStream(stream: ReadableStream<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Handle both parsed objects and raw bytes
    if (typeof value === 'object' && 'type' in value) {
      events.push(value);
    }
  }
  return events;
}

export function streamToText(events: StreamEvent[]): string {
  return events
    .filter(e => e.type === 'text-delta')
    .map(e => e.content ?? '')
    .join('');
}
```

---

## 2.6 Contract test runner (gluing adapters to contracts)

```typescript
// tests/adapters/memory/data.test.ts
import { MemoryDataAdapter } from './data';
import { runDataContractTests } from '../../contracts/data.contract.test';

describe('MemoryDataAdapter', () => {
  const adapter = new MemoryDataAdapter();

  afterEach(() => adapter.reset());

  runDataContractTests(() => adapter);
});
```

For integration tests (run only when env vars are present):

```typescript
// tests/adapters/busibox/data.integration.test.ts
import { BusiboxDataAdapter } from '../../../src/platform/adapters/busibox/data';
import { runDataContractTests } from '../../contracts/data.contract.test';

const SKIP = !process.env.DATA_API_URL;

describe.skipIf(SKIP)('BusiboxDataAdapter (integration)', () => {
  const adapter = new BusiboxDataAdapter({
    baseUrl: process.env.DATA_API_URL!,
    token: process.env.TEST_SESSION_JWT!,
  });

  runDataContractTests(() => adapter);
});
```

---

## 2.7 Package.json scripts

Add to `packages/app/package.json`:

```json
"scripts": {
  "test": "vitest run --config tests/vitest.config.ts",
  "test:watch": "vitest --config tests/vitest.config.ts",
  "test:integration": "vitest run --config tests/vitest.integration.config.ts",
  "test:integration:busibox": "vitest run --config tests/vitest.integration.config.ts --testPathPattern=busibox",
  "test:integration:vercel": "vitest run --config tests/vitest.integration.config.ts --testPathPattern=vercel",
  "test:coverage": "vitest run --config tests/vitest.config.ts --coverage"
}
```

---

## 2.8 CI considerations

Integration tests require live services. They should:
- Skip gracefully when env vars are missing (`describe.skipIf`)
- Run in CI only in dedicated jobs with service containers or test credentials
- AI contract integration tests use the cheapest model available (Haiku / gpt-4o-mini)
- Each test run provisions and tears down its own test collections (no shared state)

---

## File changes summary

| File | Action |
|------|--------|
| `packages/app/tests/vitest.config.ts` | Create |
| `packages/app/tests/vitest.integration.config.ts` | Create |
| `packages/app/tests/setup.ts` | Create |
| `packages/app/tests/helpers/fixtures.ts` | Create |
| `packages/app/tests/helpers/stream.ts` | Create |
| `packages/app/tests/helpers/env.ts` | Create |
| `packages/app/tests/contracts/ai.contract.test.ts` | Create |
| `packages/app/tests/contracts/data.contract.test.ts` | Create |
| `packages/app/tests/contracts/search.contract.test.ts` | Create |
| `packages/app/tests/contracts/storage.contract.test.ts` | Create |
| `packages/app/tests/contracts/auth.contract.test.ts` | Create |
| `packages/app/tests/adapters/memory/index.ts` | Create |
| `packages/app/tests/adapters/memory/ai.ts` | Create |
| `packages/app/tests/adapters/memory/data.ts` | Create |
| `packages/app/tests/adapters/memory/search.ts` | Create |
| `packages/app/tests/adapters/memory/storage.ts` | Create |
| `packages/app/tests/adapters/memory/auth.ts` | Create |
| `packages/app/tests/platform/config.test.ts` | Create |
| `packages/app/tests/platform/factory.test.ts` | Create |
| `packages/app/package.json` | Update (add test scripts + vitest dep) |

---

## Anti-shortcut rules

- NEVER mock the adapter under test — contract tests run against REAL adapter implementations
- NEVER share state between test cases — each test must set up and tear down its own data
- NEVER skip contract tests in CI for the memory adapter — they must always run
- NEVER write tests that depend on execution order — use `beforeEach` for setup
- NEVER hardcode API keys in test files — always read from environment variables
- NEVER test implementation details — only test the interface contract (input → output)

---

## Verification

1. `pnpm test` in `packages/app` runs all contract tests against the memory adapter — all pass
2. `pnpm test:coverage` shows >90% statement coverage for `src/platform/`
3. Memory adapter passes all 50+ contract test cases
4. Integration test files exist with proper `describe.skipIf` guards
5. `pnpm test:integration:busibox` runs (and skips) gracefully when `DATA_API_URL` is not set
6. `pnpm test:integration:vercel` runs (and skips) gracefully when `DATABASE_URL` is not set
