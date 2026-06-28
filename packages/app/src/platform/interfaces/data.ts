export type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'startsWith';

export interface Filter {
  field: string;
  op: FilterOp;
  value: unknown;
}

export interface SortField {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FieldDef {
  name: string;
  type: 'text' | 'integer' | 'float' | 'boolean' | 'timestamp' | 'json' | 'uuid';
  nullable?: boolean;
  default?: unknown;
  primaryKey?: boolean;
  unique?: boolean;
  references?: { collection: string; field: string };
}

export interface CollectionSchema {
  fields: FieldDef[];
  indexes?: Array<{ fields: string[]; unique?: boolean }>;
}

export interface QueryResult<T = Record<string, unknown>> {
  records: T[];
  total: number;
}

export interface DataAdapter {
  query<T = Record<string, unknown>>(collection: string, params?: {
    filters?: Filter[];
    sort?: SortField[];
    limit?: number;
    offset?: number;
  }): Promise<QueryResult<T>>;

  get<T = Record<string, unknown>>(collection: string, id: string): Promise<T | null>;

  insert(collection: string, records: Record<string, unknown>[]): Promise<string[]>;

  update(collection: string, filters: Filter[], data: Record<string, unknown>): Promise<number>;

  delete(collection: string, filters: Filter[]): Promise<number>;

  ensureCollection(collection: string, schema: CollectionSchema): Promise<void>;

  /** Optional transaction support (Vercel/Neon supports it; Busibox data-api does not) */
  transaction?<T>(fn: (tx: DataAdapter) => Promise<T>): Promise<T>;
}
