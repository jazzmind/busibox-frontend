import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DataAdapter } from '../../../src/platform/interfaces/data';
import { TEST_COLLECTION, TEST_SCHEMA, SAMPLE_RECORDS, buildRecord } from '../helpers/fixtures';
import { MemoryDataAdapter } from '../adapters/memory/data';

export function runDataContractTests(getAdapter: () => DataAdapter): void {
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
      const ids = await adapter.insert(TEST_COLLECTION, [buildRecord({ title: 'Item 1' })]);
      expect(ids).toHaveLength(1);
      expect(typeof ids[0]).toBe('string');
    });

    it('inserts multiple records and returns all IDs', async () => {
      const ids = await adapter.insert(TEST_COLLECTION, [
        buildRecord({ title: 'A' }),
        buildRecord({ title: 'B' }),
        buildRecord({ title: 'C' }),
      ]);
      expect(ids).toHaveLength(3);
    });

    it('auto-generates UUID when id field not provided', async () => {
      const ids = await adapter.insert(TEST_COLLECTION, [buildRecord()]);
      expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('get', () => {
    let insertedId: string;

    beforeEach(async () => {
      await adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA);
      const ids = await adapter.insert(TEST_COLLECTION, [buildRecord({ title: 'Findme', count: 42 })]);
      insertedId = ids[0];
    });

    it('retrieves a record by ID', async () => {
      const record = await adapter.get(TEST_COLLECTION, insertedId);
      expect(record).not.toBeNull();
      expect((record as Record<string, unknown>).title).toBe('Findme');
      expect((record as Record<string, unknown>).count).toBe(42);
    });

    it('returns null for non-existent ID', async () => {
      const record = await adapter.get(TEST_COLLECTION, '00000000-0000-0000-0000-000000000000');
      expect(record).toBeNull();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA);
      await adapter.insert(TEST_COLLECTION, SAMPLE_RECORDS);
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
      expect(result.records.every((r) => (r as Record<string, unknown>).active === true)).toBe(true);
    });

    it('filters with neq operator', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'active', op: 'neq', value: true }],
      });
      expect(result.records).toHaveLength(2);
    });

    it('filters with gt operator', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'count', op: 'gt', value: 25 }],
      });
      expect(result.records).toHaveLength(3);
    });

    it('filters with gte operator', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'count', op: 'gte', value: 30 }],
      });
      expect(result.records).toHaveLength(3);
    });

    it('filters with lt operator', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'count', op: 'lt', value: 25 }],
      });
      expect(result.records).toHaveLength(2);
    });

    it('filters with lte operator', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'count', op: 'lte', value: 20 }],
      });
      expect(result.records).toHaveLength(2);
    });

    it('filters with in operator', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'title', op: 'in', value: ['Alpha', 'Gamma'] }],
      });
      expect(result.records).toHaveLength(2);
    });

    it('filters with contains operator', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'title', op: 'contains', value: 'lpha' }],
      });
      expect(result.records).toHaveLength(1);
    });

    it('filters with startsWith operator', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'title', op: 'startsWith', value: 'G' }],
      });
      expect(result.records).toHaveLength(1);
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
      const counts = result.records.map((r) => (r as Record<string, unknown>).count as number);
      expect(counts).toEqual([10, 20, 30, 40, 50]);
    });

    it('sorts descending', async () => {
      const result = await adapter.query(TEST_COLLECTION, {
        sort: [{ field: 'count', direction: 'desc' }],
      });
      const counts = result.records.map((r) => (r as Record<string, unknown>).count as number);
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
      expect((result.records[0] as Record<string, unknown>).title).toBe('Gamma');
    });

    it('total reflects unfiltered count when limit is applied', async () => {
      const result = await adapter.query(TEST_COLLECTION, { limit: 2 });
      expect(result.total).toBe(5);
      expect(result.records).toHaveLength(2);
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA);
      await adapter.insert(TEST_COLLECTION, [
        buildRecord({ title: 'ToUpdate', count: 1, active: true }),
        buildRecord({ title: 'ToUpdate', count: 2, active: true }),
        buildRecord({ title: 'DontTouch', count: 3, active: false }),
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
      expect(result.records).toHaveLength(1);
      expect((result.records[0] as Record<string, unknown>).title).toBe('Updated!');
    });

    it('does not modify non-matching records', async () => {
      await adapter.update(
        TEST_COLLECTION,
        [{ field: 'title', op: 'eq', value: 'ToUpdate' }],
        { active: false },
      );
      const result = await adapter.query(TEST_COLLECTION, {
        filters: [{ field: 'title', op: 'eq', value: 'DontTouch' }],
      });
      expect(result.records).toHaveLength(1);
      expect((result.records[0] as Record<string, unknown>).active).toBe(false);
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await adapter.ensureCollection(TEST_COLLECTION, TEST_SCHEMA);
      await adapter.insert(TEST_COLLECTION, [
        buildRecord({ title: 'Keep', count: 1, active: true }),
        buildRecord({ title: 'Remove', count: 2, active: false }),
        buildRecord({ title: 'Remove', count: 3, active: false }),
      ]);
    });

    it('deletes matching records and returns count', async () => {
      const count = await adapter.delete(
        TEST_COLLECTION,
        [{ field: 'active', op: 'eq', value: false }],
      );
      expect(count).toBe(2);
    });

    it('does not delete non-matching records', async () => {
      await adapter.delete(TEST_COLLECTION, [{ field: 'active', op: 'eq', value: false }]);
      const result = await adapter.query(TEST_COLLECTION);
      expect(result.total).toBe(1);
      expect((result.records[0] as Record<string, unknown>).title).toBe('Keep');
    });

    it('returns 0 when no records match', async () => {
      const count = await adapter.delete(
        TEST_COLLECTION,
        [{ field: 'title', op: 'eq', value: 'NoMatch' }],
      );
      expect(count).toBe(0);
    });
  });
}

// Run the contract tests against the MemoryDataAdapter
describe('MemoryDataAdapter — data contract', () => {
  const adapter = new MemoryDataAdapter();

  afterEach(() => {
    adapter.reset();
  });

  runDataContractTests(() => adapter);
});
