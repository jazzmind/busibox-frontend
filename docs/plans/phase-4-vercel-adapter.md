# Phase 4: Vercel Adapter

## Objective

Implement the Vercel platform adapter using the Vercel AI SDK, Drizzle ORM + Neon Postgres, Vercel Blob, and Auth.js. This adapter enables apps to run on Vercel (or any environment with a Postgres URL and AI API keys) without any Busibox infrastructure. This is the adapter that `ai-native` and `project-ume` SaaS packages currently implement manually — we're extracting it into reusable infrastructure.

## Gate condition

- `VercelAIAdapter` passes all AI contract tests using Anthropic Haiku (cheapest model)
- `VercelDataAdapter` passes all Data contract tests against a test Neon database
- `VercelSearchAdapter` passes all Search contract tests using pgvector + FTS
- `VercelStorageAdapter` passes all Storage contract tests using Vercel Blob (or S3-compatible)
- `VercelAuthAdapter` passes all Auth contract tests with Auth.js sessions
- All platform-specific deps are optional peer dependencies — apps only install what they use
- `import '@jazzmind/busibox-app/platform/vercel'` registers all adapters

---

## 4.1 Dependency strategy

Add to `packages/app/package.json` as optional peer dependencies:

```json
"peerDependencies": {
  "next": "^16.0.10",
  "react": "^19.0.0",
  "react-dom": "^19.0.0"
},
"peerDependenciesMeta": {
  "ai": { "optional": true },
  "@ai-sdk/anthropic": { "optional": true },
  "@ai-sdk/openai": { "optional": true },
  "drizzle-orm": { "optional": true },
  "@neondatabase/serverless": { "optional": true },
  "@vercel/blob": { "optional": true },
  "next-auth": { "optional": true }
}
```

Each adapter uses dynamic `import()` so missing deps cause clear errors only when that adapter is actually used.

---

## 4.2 AI Adapter (`vercel/ai.ts`)

Wraps the Vercel AI SDK (`streamText`, `generateObject`).

```typescript
import type { AIAdapter, StreamEvent, Message, ToolDef, AgentDefinition, ModelInfo } from '../../interfaces/ai';
import type { ZodSchema } from 'zod';

interface VercelAIConfig {
  /** Default provider: 'anthropic' | 'openai' */
  defaultProvider?: string;
  /** API keys — if not provided, reads from ANTHROPIC_API_KEY / OPENAI_API_KEY env */
  anthropicApiKey?: string;
  openaiApiKey?: string;
  /** Default model per tier */
  models?: {
    fast?: string;   // e.g. 'claude-haiku-4-5' or 'gpt-4o-mini'
    smart?: string;  // e.g. 'claude-sonnet-4-5' or 'gpt-4o'
  };
}

export class VercelAIAdapter implements AIAdapter {
  private config: VercelAIConfig;

  constructor(config: VercelAIConfig = {}) {
    this.config = {
      defaultProvider: config.defaultProvider || 'anthropic',
      models: config.models || { fast: 'claude-haiku-4-5', smart: 'claude-sonnet-4-5' },
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
    const { streamText } = await import('ai');
    const model = await this.resolveModel(params.model);

    const toolDefs = params.tools ? this.convertTools(params.tools) : undefined;

    try {
      const result = streamText({
        model,
        messages: this.convertMessages(params.messages),
        system: params.systemPrompt,
        tools: toolDefs,
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
    const { generateObject } = await import('ai');
    const model = await this.resolveModel(params.model || this.config.models?.fast);

    const prompt = typeof params.input === 'string'
      ? params.input
      : JSON.stringify(params.input);

    const { object } = await generateObject({
      model,
      prompt,
      schema: params.responseSchema,
    });

    return object as T;
  }

  // syncAgents is not applicable for Vercel — agents are code-defined
  async syncAgents(): Promise<void> {
    // No-op for Vercel: agents are defined in code, not synced to a service
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', capabilities: ['chat', 'structured', 'tools'] },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'anthropic', capabilities: ['chat', 'structured', 'vision', 'tools'] },
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'anthropic', capabilities: ['chat', 'structured', 'vision', 'tools'] },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', capabilities: ['chat', 'structured', 'tools'] },
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', capabilities: ['chat', 'structured', 'vision', 'tools'] },
    ];
  }

  // --- Private helpers ---

  private async resolveModel(modelId?: string) {
    const id = modelId || this.config.models?.smart || 'claude-sonnet-4-5';

    if (id.startsWith('claude') || id.startsWith('anthropic')) {
      const { anthropic } = await import('@ai-sdk/anthropic');
      return anthropic(id);
    } else if (id.startsWith('gpt') || id.startsWith('o3') || id.startsWith('openai')) {
      const { openai } = await import('@ai-sdk/openai');
      return openai(id);
    }

    // Default to anthropic
    const { anthropic } = await import('@ai-sdk/anthropic');
    return anthropic(id);
  }

  private convertMessages(messages: Message[]) {
    return messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));
  }

  private convertTools(tools: ToolDef[]) {
    const { tool } = require('ai');
    const converted: Record<string, any> = {};
    for (const t of tools) {
      converted[t.name] = tool({ description: t.description, parameters: t.parameters });
    }
    return converted;
  }

  private transformAISDKStream(result: any): ReadableStream<StreamEvent> {
    return new ReadableStream<StreamEvent>({
      async start(controller) {
        try {
          for await (const part of result.fullStream) {
            switch (part.type) {
              case 'text-delta':
                controller.enqueue({ type: 'text-delta', content: part.textDelta });
                break;
              case 'tool-call':
                controller.enqueue({ type: 'tool-call', toolCall: { id: part.toolCallId, name: part.toolName, args: part.args } });
                break;
              case 'tool-result':
                controller.enqueue({ type: 'tool-result', toolResult: { id: part.toolCallId, result: part.result } });
                break;
              case 'error':
                controller.enqueue({ type: 'error', error: String(part.error) });
                break;
              case 'finish':
                controller.enqueue({ type: 'done', usage: { inputTokens: part.usage?.promptTokens ?? 0, outputTokens: part.usage?.completionTokens ?? 0 } });
                break;
            }
          }
          controller.close();
        } catch (err) {
          controller.enqueue({ type: 'error', error: String(err) });
          controller.enqueue({ type: 'done' });
          controller.close();
        }
      },
    });
  }

  private errorStream(message: string): ReadableStream<StreamEvent> {
    return new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'error', error: message });
        controller.enqueue({ type: 'done' });
        controller.close();
      },
    });
  }
}
```

---

## 4.3 Data Adapter (`vercel/data.ts`)

Wraps Drizzle ORM + Neon Postgres. The key challenge: mapping dynamic "collection" names to Drizzle tables.

**Approach**: Use Drizzle's raw SQL builder (`sql` template tag) for dynamic table operations. Apps register their schemas via `ensureCollection`, and the adapter maintains a type-safe mapping.

```typescript
import type { DataAdapter, Filter, SortField, CollectionSchema, QueryResult, FieldDef } from '../../interfaces/data';

interface VercelDataConfig {
  databaseUrl?: string;
}

export class VercelDataAdapter implements DataAdapter {
  private db: any;         // Drizzle instance — lazily initialized
  private schemas: Map<string, CollectionSchema> = new Map();

  constructor(private config: VercelDataConfig = {}) {}

  private async getDb() {
    if (this.db) return this.db;
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const url = this.config.databaseUrl || process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL required for Vercel data adapter');
    const sql = neon(url);
    this.db = drizzle(sql);
    return this.db;
  }

  async ensureCollection(collection: string, schema: CollectionSchema): Promise<void> {
    this.schemas.set(collection, schema);
    const db = await this.getDb();
    const { sql } = await import('drizzle-orm');

    // CREATE TABLE IF NOT EXISTS with column definitions
    const columns = schema.fields.map(f => {
      const colType = this.pgType(f);
      const constraints = [
        f.primaryKey ? 'PRIMARY KEY' : '',
        f.unique ? 'UNIQUE' : '',
        !f.nullable && !f.primaryKey ? 'NOT NULL' : '',
        f.default !== undefined ? `DEFAULT ${this.pgDefault(f)}` : '',
      ].filter(Boolean).join(' ');
      return `"${f.name}" ${colType} ${constraints}`.trim();
    });

    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS "${collection}" (${columns.join(', ')})`
    ));
  }

  async query<T>(collection: string, params?: {
    filters?: Filter[];
    sort?: SortField[];
    limit?: number;
    offset?: number;
  }): Promise<QueryResult<T>> {
    const db = await this.getDb();
    const { sql } = await import('drizzle-orm');

    let query = `SELECT * FROM "${collection}"`;
    const values: unknown[] = [];

    if (params?.filters?.length) {
      const clauses = params.filters.map(f => {
        values.push(f.value);
        return `"${f.field}" ${this.sqlOp(f.op)} $${values.length}`;
      });
      query += ` WHERE ${clauses.join(' AND ')}`;
    }

    if (params?.sort?.length) {
      const sortClauses = params.sort.map(s => `"${s.field}" ${s.direction.toUpperCase()}`);
      query += ` ORDER BY ${sortClauses.join(', ')}`;
    }

    // Get total count before limit/offset
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)::int as count');

    if (params?.limit) {
      values.push(params.limit);
      query += ` LIMIT $${values.length}`;
    }
    if (params?.offset) {
      values.push(params.offset);
      query += ` OFFSET $${values.length}`;
    }

    const [records, countResult] = await Promise.all([
      db.execute(sql.raw(query, ...values)),
      db.execute(sql.raw(countQuery, ...values.slice(0, values.length - (params?.limit ? 1 : 0) - (params?.offset ? 1 : 0)))),
    ]);

    return {
      records: records.rows as T[],
      total: countResult.rows[0]?.count ?? records.rows.length,
    };
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const db = await this.getDb();
    const { sql } = await import('drizzle-orm');
    const pk = this.getPrimaryKey(collection);
    const result = await db.execute(sql.raw(
      `SELECT * FROM "${collection}" WHERE "${pk}" = $1 LIMIT 1`, id
    ));
    return (result.rows[0] as T) ?? null;
  }

  async insert(collection: string, records: Record<string, unknown>[]): Promise<string[]> {
    const db = await this.getDb();
    const { sql } = await import('drizzle-orm');
    const { randomUUID } = await import('crypto');
    const pk = this.getPrimaryKey(collection);

    const ids: string[] = [];
    for (const record of records) {
      const id = (record[pk] as string) || randomUUID();
      const withId = { ...record, [pk]: id };
      const fields = Object.keys(withId);
      const values = Object.values(withId);
      const placeholders = values.map((_, i) => `$${i + 1}`);

      await db.execute(sql.raw(
        `INSERT INTO "${collection}" (${fields.map(f => `"${f}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
        ...values
      ));
      ids.push(id);
    }
    return ids;
  }

  async update(collection: string, filters: Filter[], data: Record<string, unknown>): Promise<number> {
    const db = await this.getDb();
    const { sql } = await import('drizzle-orm');
    const values: unknown[] = [];

    const setClauses = Object.entries(data).map(([key, val]) => {
      values.push(val);
      return `"${key}" = $${values.length}`;
    });

    const whereClauses = filters.map(f => {
      values.push(f.value);
      return `"${f.field}" ${this.sqlOp(f.op)} $${values.length}`;
    });

    const query = `UPDATE "${collection}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    const result = await db.execute(sql.raw(query, ...values));
    return result.rowCount ?? 0;
  }

  async delete(collection: string, filters: Filter[]): Promise<number> {
    const db = await this.getDb();
    const { sql } = await import('drizzle-orm');
    const values: unknown[] = [];

    const whereClauses = filters.map(f => {
      values.push(f.value);
      return `"${f.field}" ${this.sqlOp(f.op)} $${values.length}`;
    });

    const query = `DELETE FROM "${collection}" WHERE ${whereClauses.join(' AND ')}`;
    const result = await db.execute(sql.raw(query, ...values));
    return result.rowCount ?? 0;
  }

  // --- Private helpers ---

  private getPrimaryKey(collection: string): string {
    const schema = this.schemas.get(collection);
    const pk = schema?.fields.find(f => f.primaryKey);
    return pk?.name ?? 'id';
  }

  private pgType(f: FieldDef): string {
    switch (f.type) {
      case 'uuid': return f.primaryKey ? 'UUID DEFAULT gen_random_uuid()' : 'UUID';
      case 'text': return 'TEXT';
      case 'integer': return 'INTEGER';
      case 'float': return 'DOUBLE PRECISION';
      case 'boolean': return 'BOOLEAN';
      case 'timestamp': return 'TIMESTAMPTZ';
      case 'json': return 'JSONB';
      default: return 'TEXT';
    }
  }

  private pgDefault(f: FieldDef): string {
    if (f.type === 'boolean') return f.default ? 'TRUE' : 'FALSE';
    if (f.type === 'timestamp' && f.default === 'now') return 'NOW()';
    return `'${f.default}'`;
  }

  private sqlOp(op: string): string {
    switch (op) {
      case 'eq': return '=';
      case 'neq': return '!=';
      case 'gt': return '>';
      case 'gte': return '>=';
      case 'lt': return '<';
      case 'lte': return '<=';
      case 'in': return 'IN';
      case 'contains': return 'ILIKE';
      case 'startsWith': return 'ILIKE';
      default: return '=';
    }
  }
}
```

---

## 4.4 Search Adapter (`vercel/search.ts`)

Uses Postgres full-text search + optional pgvector for semantic search.

```typescript
import type { SearchAdapter, SearchResult } from '../../interfaces/search';
import type { Filter } from '../../interfaces/data';

interface VercelSearchConfig {
  databaseUrl?: string;
  /** Table that stores searchable content chunks */
  searchTable?: string;
  /** If true, uses pgvector for semantic search (requires pgvector extension) */
  enableVector?: boolean;
}

export class VercelSearchAdapter implements SearchAdapter {
  private db: any;
  private config: VercelSearchConfig;

  constructor(config: VercelSearchConfig = {}) {
    this.config = {
      searchTable: config.searchTable || 'search_index',
      enableVector: config.enableVector ?? false,
      ...config,
    };
  }

  private async getDb() {
    if (this.db) return this.db;
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const url = this.config.databaseUrl || process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL required for Vercel search adapter');
    this.db = drizzle(neon(url));
    return this.db;
  }

  async search(params: {
    query: string;
    collections?: string[];
    mode?: 'hybrid' | 'semantic' | 'keyword';
    limit?: number;
    filters?: Filter[];
  }): Promise<SearchResult[]> {
    const db = await this.getDb();
    const { sql } = await import('drizzle-orm');
    const mode = params.mode || 'hybrid';
    const limit = params.limit || 10;
    const table = this.config.searchTable;

    if (mode === 'keyword' || (mode === 'hybrid' && !this.config.enableVector)) {
      return this.keywordSearch(db, sql, params, table!, limit);
    }

    if (mode === 'semantic' && this.config.enableVector) {
      return this.vectorSearch(db, sql, params, table!, limit);
    }

    // Hybrid: combine keyword + vector scores
    if (mode === 'hybrid' && this.config.enableVector) {
      const [kw, vec] = await Promise.all([
        this.keywordSearch(db, sql, params, table!, limit * 2),
        this.vectorSearch(db, sql, params, table!, limit * 2),
      ]);
      return this.mergeResults(kw, vec, limit);
    }

    return this.keywordSearch(db, sql, params, table!, limit);
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Use AI SDK embedding if available
    const { embed } = await import('ai');
    const { anthropic } = await import('@ai-sdk/anthropic');
    // Note: Anthropic doesn't have an embedding model; fall back to local or OpenAI
    // This is a limitation — apps needing embeddings should configure the search adapter
    throw new Error('Embedding not yet configured for Vercel adapter. Configure an embedding provider.');
  }

  private async keywordSearch(db: any, sql: any, params: any, table: string, limit: number): Promise<SearchResult[]> {
    const tsQuery = params.query.split(/\s+/).join(' & ');
    let query = `
      SELECT id, collection, content, metadata,
             ts_rank(to_tsvector('english', content), to_tsquery('english', $1)) as score
      FROM "${table}"
      WHERE to_tsvector('english', content) @@ to_tsquery('english', $1)
    `;
    const values: unknown[] = [tsQuery];

    if (params.collections?.length) {
      values.push(params.collections);
      query += ` AND collection = ANY($${values.length})`;
    }

    query += ` ORDER BY score DESC LIMIT ${limit}`;

    const result = await db.execute(sql.raw(query, ...values));
    return result.rows.map((r: any) => ({
      id: r.id,
      collection: r.collection,
      content: r.content,
      score: r.score,
      metadata: r.metadata,
    }));
  }

  private async vectorSearch(db: any, sql: any, params: any, table: string, limit: number): Promise<SearchResult[]> {
    // Requires pgvector extension and an embedding column
    const embedding = await this.getQueryEmbedding(params.query);
    const values: unknown[] = [JSON.stringify(embedding)];

    let query = `
      SELECT id, collection, content, metadata,
             1 - (embedding <=> $1::vector) as score
      FROM "${table}"
    `;

    if (params.collections?.length) {
      values.push(params.collections);
      query += ` WHERE collection = ANY($${values.length})`;
    }

    query += ` ORDER BY embedding <=> $1::vector LIMIT ${limit}`;

    const result = await db.execute(sql.raw(query, ...values));
    return result.rows.map((r: any) => ({
      id: r.id,
      collection: r.collection,
      content: r.content,
      score: r.score,
      metadata: r.metadata,
    }));
  }

  private async getQueryEmbedding(query: string): Promise<number[]> {
    // Placeholder — apps must configure their embedding provider
    throw new Error('Vector search requires embedding configuration');
  }

  private mergeResults(kw: SearchResult[], vec: SearchResult[], limit: number): SearchResult[] {
    const scoreMap = new Map<string, { result: SearchResult; kwScore: number; vecScore: number }>();

    for (const r of kw) {
      scoreMap.set(r.id, { result: r, kwScore: r.score, vecScore: 0 });
    }
    for (const r of vec) {
      const existing = scoreMap.get(r.id);
      if (existing) {
        existing.vecScore = r.score;
      } else {
        scoreMap.set(r.id, { result: r, kwScore: 0, vecScore: r.score });
      }
    }

    return Array.from(scoreMap.values())
      .map(({ result, kwScore, vecScore }) => ({
        ...result,
        score: kwScore * 0.4 + vecScore * 0.6,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
```

---

## 4.5 Storage Adapter (`vercel/storage.ts`)

Wraps `@vercel/blob` for file storage.

```typescript
import type { StorageAdapter, UploadResult } from '../../interfaces/storage';

interface VercelStorageConfig {
  /** Vercel Blob token — defaults to BLOB_READ_WRITE_TOKEN env */
  token?: string;
}

export class VercelStorageAdapter implements StorageAdapter {
  private config: VercelStorageConfig;

  constructor(config: VercelStorageConfig = {}) {
    this.config = config;
  }

  async upload(file: File | Buffer | ReadableStream, options: {
    filename: string;
    contentType?: string;
    visibility?: 'private' | 'public';
    metadata?: Record<string, string>;
  }): Promise<UploadResult> {
    const { put } = await import('@vercel/blob');

    let body: Buffer | ReadableStream;
    if (file instanceof Buffer) {
      body = file;
    } else if (file instanceof File) {
      body = Buffer.from(await file.arrayBuffer());
    } else {
      body = file;
    }

    const blob = await put(options.filename, body, {
      access: options.visibility === 'private' ? 'private' : 'public',
      contentType: options.contentType,
      token: this.config.token || process.env.BLOB_READ_WRITE_TOKEN,
    });

    return {
      id: blob.pathname,
      url: blob.url,
      size: blob.size,
      contentType: blob.contentType,
    };
  }

  async download(id: string): Promise<ReadableStream> {
    const url = await this.getUrl(id);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    return response.body!;
  }

  async delete(id: string): Promise<void> {
    const { del } = await import('@vercel/blob');
    const url = await this.getUrl(id);
    await del(url, { token: this.config.token || process.env.BLOB_READ_WRITE_TOKEN });
  }

  async getUrl(id: string): Promise<string> {
    // Vercel Blob URLs are the IDs themselves or can be listed
    if (id.startsWith('http')) return id;
    const { list } = await import('@vercel/blob');
    const result = await list({
      prefix: id,
      limit: 1,
      token: this.config.token || process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (result.blobs.length === 0) throw new Error(`File not found: ${id}`);
    return result.blobs[0].url;
  }
}
```

---

## 4.6 Auth Adapter (`vercel/auth.ts`)

Wraps Auth.js v5 for session management.

```typescript
import type { AuthAdapter, PlatformUser, TokenClaims } from '../../interfaces/auth';

interface VercelAuthConfig {
  /** Path to the Auth.js config export — apps provide their own */
  authConfig?: any;
}

export class VercelAuthAdapter implements AuthAdapter {
  private config: VercelAuthConfig;

  constructor(config: VercelAuthConfig = {}) {
    this.config = config;
  }

  async getCurrentUser(request: Request): Promise<PlatformUser | null> {
    // Auth.js integration — reads session from cookie
    try {
      const { auth } = this.config.authConfig || await import('next-auth');
      const session = await auth();
      if (!session?.user) return null;
      return {
        id: session.user.id!,
        email: session.user.email!,
        name: session.user.name ?? undefined,
        role: (session.user as any).role ?? 'user',
      };
    } catch {
      return null;
    }
  }

  async getServiceToken(audience: string): Promise<string> {
    // For Vercel, service tokens are typically not needed (direct DB access)
    // But apps can override for API-to-API communication
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    return new SignJWT({ aud: audience })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);
  }

  async validateToken(token: string): Promise<TokenClaims | null> {
    try {
      const { jwtVerify } = await import('jose');
      const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
      const { payload } = await jwtVerify(token, secret);
      return payload as TokenClaims;
    } catch {
      return null;
    }
  }

  async requireAuth(request: Request): Promise<PlatformUser> {
    const user = await this.getCurrentUser(request);
    if (!user) {
      throw new Error('Unauthorized');
    }
    return user;
  }
}
```

---

## 4.7 Registration entry point (`vercel/index.ts`)

```typescript
import { registerAdapter } from '../../index';
import { VercelAIAdapter } from './ai';
import { VercelDataAdapter } from './data';
import { VercelSearchAdapter } from './search';
import { VercelStorageAdapter } from './storage';
import { VercelAuthAdapter } from './auth';

registerAdapter('vercel', 'ai', new VercelAIAdapter());
registerAdapter('vercel', 'data', new VercelDataAdapter());
registerAdapter('vercel', 'search', new VercelSearchAdapter());
registerAdapter('vercel', 'storage', new VercelStorageAdapter());
registerAdapter('vercel', 'auth', new VercelAuthAdapter());

export { VercelAIAdapter, VercelDataAdapter, VercelSearchAdapter, VercelStorageAdapter, VercelAuthAdapter };
```

---

## 4.8 Integration test setup for Vercel adapter

```typescript
// tests/adapters/vercel/data.integration.test.ts
import { VercelDataAdapter } from '../../../src/platform/adapters/vercel/data';
import { runDataContractTests } from '../../contracts/data.contract.test';

const SKIP = !process.env.DATABASE_URL;

describe.skipIf(SKIP)('VercelDataAdapter (integration)', () => {
  const adapter = new VercelDataAdapter({
    databaseUrl: process.env.DATABASE_URL!,
  });

  // Clean up test tables after each test
  afterEach(async () => {
    // Drop test tables created by ensureCollection
    // The contract tests use 'test_items' as the collection name
  });

  runDataContractTests(() => adapter);
});
```

---

## File changes summary

| File | Action |
|------|--------|
| `packages/app/src/platform/adapters/vercel/index.ts` | Create |
| `packages/app/src/platform/adapters/vercel/ai.ts` | Create |
| `packages/app/src/platform/adapters/vercel/data.ts` | Create |
| `packages/app/src/platform/adapters/vercel/search.ts` | Create |
| `packages/app/src/platform/adapters/vercel/storage.ts` | Create |
| `packages/app/src/platform/adapters/vercel/auth.ts` | Create |
| `packages/app/package.json` | Update (add optional peerDependencies) |
| `packages/app/tests/adapters/vercel/ai.integration.test.ts` | Create |
| `packages/app/tests/adapters/vercel/data.integration.test.ts` | Create |
| `packages/app/tests/adapters/vercel/search.integration.test.ts` | Create |
| `packages/app/tests/adapters/vercel/storage.integration.test.ts` | Create |

---

## Anti-shortcut rules

- NEVER bundle Vercel-specific dependencies as direct dependencies — they MUST be optional peer deps with dynamic `import()`
- NEVER store Drizzle schema objects in the adapter — use raw SQL via `sql.raw()` for dynamic table operations
- NEVER assume pgvector is installed — the search adapter must gracefully fall back to keyword-only FTS
- NEVER call `CREATE TABLE` without `IF NOT EXISTS` — `ensureCollection` must be idempotent
- NEVER store database connections as globals — use lazy initialization per-request for serverless compatibility
- NEVER import `next-auth` at module level in the auth adapter — it fails outside Next.js runtime
- NEVER assume Vercel Blob is available — the storage adapter should throw a clear error if `BLOB_READ_WRITE_TOKEN` is missing

---

## Verification

1. `pnpm test:integration:vercel` passes all contract tests against a test Neon database
2. `VercelDataAdapter` can create tables, insert, query, update, delete
3. `VercelAIAdapter.streamChat()` returns streaming events from Claude Haiku
4. `VercelAIAdapter.invoke()` returns Zod-validated structured output
5. `VercelSearchAdapter.search({ mode: 'keyword' })` returns FTS results
6. `VercelStorageAdapter` upload/download cycle works with Vercel Blob
7. Missing optional deps produce clear error messages (not cryptic module resolution failures)
8. Total integration test cost < $0.50 per run (use cheapest models, minimal tokens)
