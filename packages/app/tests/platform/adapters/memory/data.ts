import { randomUUID } from 'crypto';
import type {
  DataAdapter,
  CollectionSchema,
  Filter,
  QueryResult,
  SortField,
} from '../../../../src/platform/interfaces/data';

interface CollectionStore {
  schema: CollectionSchema;
  records: Map<string, Record<string, unknown>>;
}

export class MemoryDataAdapter implements DataAdapter {
  private collections: Map<string, CollectionStore> = new Map();

  async ensureCollection(collection: string, schema: CollectionSchema): Promise<void> {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, { schema, records: new Map() });
    }
  }

  async insert(collection: string, records: Record<string, unknown>[]): Promise<string[]> {
    const col = this.getCollection(collection);
    const ids: string[] = [];
    for (const record of records) {
      const id = (record['id'] as string) || randomUUID();
      col.records.set(id, { ...record, id });
      ids.push(id);
    }
    return ids;
  }

  async get<T = Record<string, unknown>>(collection: string, id: string): Promise<T | null> {
    const col = this.collections.get(collection);
    if (!col) return null;
    return (col.records.get(id) as T) ?? null;
  }

  async query<T = Record<string, unknown>>(
    collection: string,
    params?: {
      filters?: Filter[];
      sort?: SortField[];
      limit?: number;
      offset?: number;
    },
  ): Promise<QueryResult<T>> {
    const col = this.getCollection(collection);
    let records = Array.from(col.records.values());

    if (params?.filters?.length) {
      records = records.filter((r) =>
        params.filters!.every((f) => this.matchFilter(r, f)),
      );
    }

    const total = records.length;

    if (params?.sort?.length) {
      records = this.sortRecords(records, params.sort);
    }

    if (params?.offset) records = records.slice(params.offset);
    if (params?.limit) records = records.slice(0, params.limit);

    return { records: records as T[], total };
  }

  async update(
    collection: string,
    filters: Filter[],
    data: Record<string, unknown>,
  ): Promise<number> {
    const col = this.getCollection(collection);
    let count = 0;
    for (const [id, record] of col.records) {
      if (filters.every((f) => this.matchFilter(record, f))) {
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
      if (filters.every((f) => this.matchFilter(record, f))) {
        col.records.delete(id);
        count++;
      }
    }
    return count;
  }

  /** Reset all data — call between tests */
  reset(): void {
    this.collections.clear();
  }

  private getCollection(name: string): CollectionStore {
    const col = this.collections.get(name);
    if (!col) {
      throw new Error(
        `Collection "${name}" not found. Call ensureCollection first.`,
      );
    }
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

  private sortRecords(
    records: Record<string, unknown>[],
    sorts: SortField[],
  ): Record<string, unknown>[] {
    return [...records].sort((a, b) => {
      for (const s of sorts) {
        const av = a[s.field] as string | number;
        const bv = b[s.field] as string | number;
        if (av < bv) return s.direction === 'asc' ? -1 : 1;
        if (av > bv) return s.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
}
