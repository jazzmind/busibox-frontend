import type {
  DataAdapter,
  Filter,
  FilterOp,
  CollectionSchema,
  FieldDef,
  QueryResult,
  SortField,
} from '../../interfaces/data';
import { randomUUID } from 'crypto';

interface VercelDataConfig {
  databaseUrl?: string;
}

type SqlClient = {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  end(): Promise<void>;
};

export class VercelDataAdapter implements DataAdapter {
  private databaseUrl: string;
  private _client: SqlClient | null = null;

  constructor(config: VercelDataConfig = {}) {
    this.databaseUrl =
      config.databaseUrl ?? process.env.DATABASE_URL ?? '';
  }

  async ensureCollection(collection: string, schema: CollectionSchema): Promise<void> {
    const sql = buildCreateTableSql(collection, schema);
    await this.execute(sql);

    for (const index of schema.indexes ?? []) {
      const indexName = `${collection}_${index.fields.join('_')}_idx`;
      const unique = index.unique ? 'UNIQUE ' : '';
      await this.execute(
        `CREATE ${unique}INDEX IF NOT EXISTS "${indexName}" ON "${collection}" (${index.fields.map((f) => `"${f}"`).join(', ')})`,
      );
    }
  }

  async insert(collection: string, records: Record<string, unknown>[]): Promise<string[]> {
    const ids: string[] = [];

    for (const record of records) {
      const id = (record['id'] as string) ?? randomUUID();
      const withId: Record<string, unknown> = { ...record, id };
      const keys = Object.keys(withId);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map((k) => withId[k]);
      const cols = keys.map((k) => `"${k}"`).join(', ');

      await this.execute(
        `INSERT INTO "${collection}" (${cols}) VALUES (${placeholders})`,
        values,
      );
      ids.push(id);
    }

    return ids;
  }

  async get<T = Record<string, unknown>>(collection: string, id: string): Promise<T | null> {
    const result = await this.execute(
      `SELECT * FROM "${collection}" WHERE id = $1 LIMIT 1`,
      [id],
    );
    return (result.rows[0] as T) ?? null;
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
    const { where, values } = buildWhereClause(params?.filters);

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM "${collection}"${where}`;
    const countResult = await this.execute(countSql, values);
    const total = Number(countResult.rows[0]['total'] ?? 0);

    // Data query
    const orderBy = buildOrderBy(params?.sort);
    const limit = params?.limit != null ? ` LIMIT ${params.limit}` : '';
    const offset = params?.offset != null ? ` OFFSET ${params.offset}` : '';

    const dataSql = `SELECT * FROM "${collection}"${where}${orderBy}${limit}${offset}`;
    const dataResult = await this.execute(dataSql, values);

    return { records: dataResult.rows as T[], total };
  }

  async update(
    collection: string,
    filters: Filter[],
    data: Record<string, unknown>,
  ): Promise<number> {
    if (Object.keys(data).length === 0) return 0;

    const setKeys = Object.keys(data);
    const setClause = setKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const setValues = setKeys.map((k) => data[k]);

    const { where, values: filterValues } = buildWhereClause(filters, setValues.length);

    const result = await this.execute(
      `UPDATE "${collection}" SET ${setClause}${where}`,
      [...setValues, ...filterValues],
    );

    return result.rowCount;
  }

  async delete(collection: string, filters: Filter[]): Promise<number> {
    const { where, values } = buildWhereClause(filters);
    const result = await this.execute(
      `DELETE FROM "${collection}"${where}`,
      values,
    );
    return result.rowCount;
  }

  async transaction<T>(fn: (tx: DataAdapter) => Promise<T>): Promise<T> {
    // For Neon serverless, we run in a single query context
    // For now, delegate to the same adapter (full transaction support requires connection pooling)
    return fn(this);
  }

  // --- Private helpers ---

  private async getClient(): Promise<SqlClient> {
    if (this._client) return this._client;

    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(this.databaseUrl);

      // Wrap neon tagged-template SQL client into a query(sql, params) interface.
      // Neon supports (text, params) call form even though TS types only expose tagged template.
      const sqlFn = sql as unknown as (text: string, params?: unknown[]) => Promise<unknown[]>;
      this._client = {
        async query(statement: string, params: unknown[] = []) {
          const result = await sqlFn(statement, params);
          const rows = Array.isArray(result) ? result : [];
          return {
            rows: rows as Record<string, unknown>[],
            rowCount: rows.length,
          };
        },
        async end() {},
      };
      return this._client;
    } catch {
      // Fall back to pg if neon is not available
      try {
        const { Client } = await import('pg' as string);
        const client = new (Client as { new(opts: object): SqlClient })({ connectionString: this.databaseUrl });
        await (client as unknown as { connect(): Promise<void> }).connect();
        this._client = client;
        return this._client;
      } catch {
        throw new Error(
          'Vercel data adapter requires "@neondatabase/serverless" or "pg". ' +
          'Run: pnpm add @neondatabase/serverless',
        );
      }
    }
  }

  private async execute(sql: string, params: unknown[] = []): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
    const client = await this.getClient();
    return client.query(sql, params);
  }
}

// --- SQL builders ---

function buildCreateTableSql(collection: string, schema: CollectionSchema): string {
  const cols = schema.fields.map((f) => fieldToSql(f)).join(',\n  ');
  return `CREATE TABLE IF NOT EXISTS "${collection}" (\n  ${cols}\n)`;
}

function fieldToSql(field: FieldDef): string {
  const type = pgType(field.type);
  const parts = [`"${field.name}" ${type}`];

  if (field.primaryKey) parts.push('PRIMARY KEY');
  if (!field.nullable && !field.primaryKey) parts.push('NOT NULL');
  if (field.unique && !field.primaryKey) parts.push('UNIQUE');
  if (field.default !== undefined) {
    parts.push(`DEFAULT ${pgDefault(field.default, field.type)}`);
  }

  return parts.join(' ');
}

function pgType(type: FieldDef['type']): string {
  switch (type) {
    case 'text': return 'TEXT';
    case 'integer': return 'INTEGER';
    case 'float': return 'DOUBLE PRECISION';
    case 'boolean': return 'BOOLEAN';
    case 'timestamp': return 'TIMESTAMPTZ';
    case 'json': return 'JSONB';
    case 'uuid': return 'UUID';
    default: return 'TEXT';
  }
}

function pgDefault(value: unknown, type: FieldDef['type']): string {
  if (value === 'now()' || value === 'CURRENT_TIMESTAMP') return 'NOW()';
  if (type === 'uuid' && value === 'gen_random_uuid()') return 'gen_random_uuid()';
  if (typeof value === 'string') return `'${value}'`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

const OP_SQL: Record<FilterOp, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  in: 'IN',
  contains: 'LIKE',
  startsWith: 'LIKE',
};

function buildWhereClause(
  filters?: Filter[],
  paramOffset = 0,
): { where: string; values: unknown[] } {
  if (!filters?.length) return { where: '', values: [] };

  const values: unknown[] = [];
  const conditions = filters.map((f) => {
    paramOffset++;
    if (f.op === 'in') {
      values.push(f.value);
      return `"${f.field}" = ANY($${paramOffset})`;
    }
    if (f.op === 'contains') {
      values.push(`%${f.value}%`);
      return `"${f.field}" LIKE $${paramOffset}`;
    }
    if (f.op === 'startsWith') {
      values.push(`${f.value}%`);
      return `"${f.field}" LIKE $${paramOffset}`;
    }
    values.push(f.value);
    return `"${f.field}" ${OP_SQL[f.op]} $${paramOffset}`;
  });

  return { where: ` WHERE ${conditions.join(' AND ')}`, values };
}

function buildOrderBy(sorts?: SortField[]): string {
  if (!sorts?.length) return '';
  const parts = sorts.map((s) => `"${s.field}" ${s.direction.toUpperCase()}`);
  return ` ORDER BY ${parts.join(', ')}`;
}
