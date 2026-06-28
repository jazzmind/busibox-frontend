import type {
  DataAdapter,
  Filter,
  FilterOp,
  CollectionSchema,
  QueryResult,
  SortField,
} from '../../interfaces/data';

interface BusiboxDataConfig {
  dataApiUrl?: string;
  getToken: () => Promise<string>;
}

interface DataApiDocument {
  id: string;
  name: string;
  schema: unknown;
  source_app?: string;
}

interface DataApiRecord {
  id: string;
  [key: string]: unknown;
}

export class BusiboxDataAdapter implements DataAdapter {
  private baseUrl: string;
  private getToken: () => Promise<string>;
  /** Cache doc_id by collection name */
  private docIdCache: Map<string, string> = new Map();

  constructor(config: BusiboxDataConfig) {
    this.baseUrl =
      config.dataApiUrl ??
      (() => {
        const host = process.env.DATA_API_HOST ?? 'localhost';
        const port = process.env.DATA_API_PORT ?? '8002';
        return `http://${host}:${port}`;
      })();
    this.getToken = config.getToken;
  }

  async ensureCollection(collection: string, schema: CollectionSchema): Promise<void> {
    const token = await this.getToken();

    // Check if document already exists
    const existing = await this.findDocument(token, collection);
    if (existing) {
      this.docIdCache.set(collection, existing.id);
      return;
    }

    // Create the document
    const response = await this.fetch(token, '/documents', {
      method: 'POST',
      body: JSON.stringify({
        name: collection,
        schema: collectionSchemaToDataApi(schema),
        visibility: 'personal',
      }),
    });

    const doc = await response.json() as DataApiDocument;
    this.docIdCache.set(collection, doc.id);
  }

  async insert(collection: string, records: Record<string, unknown>[]): Promise<string[]> {
    const [token, docId] = await this.getTokenAndDocId(collection);

    const response = await this.fetch(token, `/documents/${docId}/records`, {
      method: 'POST',
      body: JSON.stringify({ records }),
    });

    const result = await response.json() as { ids: string[] };
    return result.ids;
  }

  async get<T = Record<string, unknown>>(collection: string, id: string): Promise<T | null> {
    const [token, docId] = await this.getTokenAndDocId(collection);

    const response = await this.fetchRaw(token, `/documents/${docId}/records/${id}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Data API error: ${response.status}`);

    const record = await response.json() as DataApiRecord;
    return record as T;
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
    const [token, docId] = await this.getTokenAndDocId(collection);

    const body: Record<string, unknown> = {
      filters: params?.filters ? filtersToDataApi(params.filters) : [],
      sort: params?.sort ?? [],
      limit: params?.limit ?? 100,
      offset: params?.offset ?? 0,
    };

    const response = await this.fetch(token, `/documents/${docId}/records/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const result = await response.json() as { records: DataApiRecord[]; total: number };
    return { records: result.records as T[], total: result.total };
  }

  async update(
    collection: string,
    filters: Filter[],
    data: Record<string, unknown>,
  ): Promise<number> {
    const [token, docId] = await this.getTokenAndDocId(collection);

    const response = await this.fetch(token, `/documents/${docId}/records`, {
      method: 'PATCH',
      body: JSON.stringify({
        filters: filtersToDataApi(filters),
        data,
      }),
    });

    const result = await response.json() as { updated: number };
    return result.updated;
  }

  async delete(collection: string, filters: Filter[]): Promise<number> {
    const [token, docId] = await this.getTokenAndDocId(collection);

    const response = await this.fetch(token, `/documents/${docId}/records`, {
      method: 'DELETE',
      body: JSON.stringify({ filters: filtersToDataApi(filters) }),
    });

    const result = await response.json() as { deleted: number };
    return result.deleted;
  }

  // --- Private helpers ---

  private async getTokenAndDocId(collection: string): Promise<[string, string]> {
    const token = await this.getToken();
    const docId = await this.requireDocId(token, collection);
    return [token, docId];
  }

  private async requireDocId(token: string, collection: string): Promise<string> {
    if (this.docIdCache.has(collection)) return this.docIdCache.get(collection)!;

    const doc = await this.findDocument(token, collection);
    if (!doc) {
      throw new Error(
        `Collection "${collection}" not found. Call ensureCollection first.`,
      );
    }
    this.docIdCache.set(collection, doc.id);
    return doc.id;
  }

  private async findDocument(
    token: string,
    collection: string,
  ): Promise<DataApiDocument | null> {
    const response = await this.fetchRaw(token, '/documents?limit=100');
    if (!response.ok) return null;
    const result = await response.json() as { documents: DataApiDocument[] };
    return result.documents.find((d) => d.name === collection) ?? null;
  }

  private async fetch(
    token: string,
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const response = await this.fetchRaw(token, path, init);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Data API error ${response.status}: ${body}`);
    }
    return response;
  }

  private async fetchRaw(
    token: string,
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> ?? {}),
      },
    });
  }
}

function collectionSchemaToDataApi(schema: CollectionSchema): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const field of schema.fields) {
    fields[field.name] = {
      type: field.type,
      nullable: field.nullable ?? true,
      primary_key: field.primaryKey ?? false,
      unique: field.unique ?? false,
      default: field.default,
      references: field.references,
    };
  }
  return { fields, indexes: schema.indexes ?? [] };
}

const OP_MAP: Record<FilterOp, string> = {
  eq: 'eq',
  neq: 'neq',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  in: 'in',
  contains: 'contains',
  startsWith: 'starts_with',
};

function filtersToDataApi(filters: Filter[]): unknown[] {
  return filters.map((f) => ({
    field: f.field,
    op: OP_MAP[f.op],
    value: f.value,
  }));
}
