import type { Message } from '../../../src/platform/interfaces/ai';
import type { CollectionSchema } from '../../../src/platform/interfaces/data';

export const TEST_COLLECTION = 'test_items';

export const TEST_SCHEMA: CollectionSchema = {
  fields: [
    { name: 'id', type: 'uuid', primaryKey: true },
    { name: 'title', type: 'text' },
    { name: 'count', type: 'integer', nullable: true },
    { name: 'active', type: 'boolean', default: true },
    { name: 'created_at', type: 'timestamp' },
    { name: 'metadata', type: 'json', nullable: true },
  ],
};

export const SAMPLE_MESSAGES: Message[] = [
  { role: 'user', content: 'Hello, how are you?' },
];

export const SAMPLE_RECORDS = [
  { title: 'Alpha', count: 10, active: true, created_at: '2024-01-01T00:00:00Z' },
  { title: 'Beta', count: 20, active: false, created_at: '2024-01-02T00:00:00Z' },
  { title: 'Gamma', count: 30, active: true, created_at: '2024-01-03T00:00:00Z' },
  { title: 'Delta', count: 40, active: true, created_at: '2024-01-04T00:00:00Z' },
  { title: 'Epsilon', count: 50, active: false, created_at: '2024-01-05T00:00:00Z' },
];

export function buildRecord(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Item',
    count: 1,
    active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
