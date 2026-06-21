# Phase 3: Busibox Adapter

## Objective

Implement the Busibox platform adapter by wrapping the existing `lib/agent/`, `lib/data/`, `lib/search/`, and `lib/authz/` clients into the platform interface contracts. This adapter is the "easy" one — no new dependencies, just bridging existing code to the new interfaces.

## Gate condition

- `BusiboxAIAdapter` passes all AI contract tests against a running agent-api
- `BusiboxDataAdapter` passes all Data contract tests against a running data-api
- `BusiboxSearchAdapter` passes all Search contract tests against a running search-api
- `BusiboxStorageAdapter` passes all Storage contract tests against a running data-api
- `BusiboxAuthAdapter` passes all Auth contract tests
- `import '@jazzmind/busibox-app/platform/busibox'` registers all adapters with the factory
- Existing Busibox apps (portal, agents, chat) continue working unchanged

---

## 3.1 Adapter structure

```
packages/app/src/platform/adapters/busibox/
├── index.ts            # Registers all Busibox adapters with the factory
├── ai.ts              # BusiboxAIAdapter — wraps lib/agent/
├── data.ts            # BusiboxDataAdapter — wraps lib/data/
├── search.ts          # BusiboxSearchAdapter — wraps lib/search/
├── storage.ts         # BusiboxStorageAdapter — wraps lib/data/ upload endpoints
└── auth.ts            # BusiboxAuthAdapter — wraps lib/authz/
```

---

## 3.2 AI Adapter (`busibox/ai.ts`)

Wraps existing `lib/agent/` client infrastructure.

```typescript
import type { AIAdapter, StreamEvent, Message, ToolDef, AgentDefinition, ModelInfo } from '../../interfaces/ai';
import type { ZodSchema } from 'zod';

interface BusiboxAIConfig {
  agentApiUrl?: string;
  getToken: () => Promise<string>;
}

export class BusiboxAIAdapter implements AIAdapter {
  private baseUrl: string;
  private getToken: () => Promise<string>;

  constructor(config: BusiboxAIConfig) {
    this.baseUrl = config.agentApiUrl || process.env.AGENT_API_URL || 'http://localhost:8000';
    this.getToken = config.getToken;
  }

  async streamChat(params: {
    messages: Message[];
    agent?: string;
    model?: string;
    tools?: ToolDef[];
    systemPrompt?: string;
  }): Promise<ReadableStream<StreamEvent>> {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}/chat/message/stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: this.convertMessages(params.messages),
        agent_name: params.agent,
        model: params.model,
        system_prompt: params.systemPrompt,
        tools: params.tools?.map(t => t.name),
      }),
    });

    if (!response.ok) {
      return this.errorStream(`Agent API error: ${response.status} ${response.statusText}`);
    }

    return this.transformSSEStream(response.body!);
  }

  async invoke<T>(params: {
    agent?: string;
    input: Record<string, unknown>;
    responseSchema: ZodSchema<T>;
    model?: string;
  }): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}/runs/invoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_name: params.agent,
        input: params.input,
        response_schema: this.zodToJsonSchema(params.responseSchema),
        model: params.model,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent API invoke failed: ${response.status}`);
    }

    const data = await response.json();
    return params.responseSchema.parse(data.output ?? data);
  }

  async syncAgents(definitions: AgentDefinition[]): Promise<void> {
    // Delegate to existing syncAgentDefinitions from lib/agent/sync
    const { syncAgentDefinitions } = await import('../../lib/agent/sync');
    const token = await this.getToken();
    await syncAgentDefinitions(definitions, {
      agentApiUrl: this.baseUrl,
      token,
    });
  }

  async listModels(): Promise<ModelInfo[]> {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}/llm/models`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.models ?? [];
  }

  // --- Private helpers ---

  private convertMessages(messages: Message[]) {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
      tool_calls: m.toolCalls,
      tool_results: m.toolResults,
    }));
  }

  private transformSSEStream(body: ReadableStream<Uint8Array>): ReadableStream<StreamEvent> {
    // Transform raw SSE bytes into StreamEvent objects
    // Reuses logic pattern from lib/agent/stream-event-processor.ts
    const decoder = new TextDecoder();
    let buffer = '';

    return new ReadableStream<StreamEvent>({
      async start(controller) {
        const reader = body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue({ type: 'done' });
              controller.close();
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const event = JSON.parse(line.slice(6));
                controller.enqueue(mapAgentEvent(event));
              }
            }
          }
        } catch (err) {
          controller.enqueue({ type: 'error', error: String(err) });
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

  private zodToJsonSchema(schema: ZodSchema): Record<string, unknown> {
    // Minimal Zod-to-JSON-Schema conversion for agent-api's response_schema
    // agent-api expects JSON Schema format
    const { zodToJsonSchema } = require('zod-to-json-schema');
    return zodToJsonSchema(schema);
  }
}

function mapAgentEvent(event: Record<string, unknown>): StreamEvent {
  switch (event.type) {
    case 'content': return { type: 'text-delta', content: event.text as string };
    case 'tool_use': return { type: 'tool-call', toolCall: event.tool_call as any };
    case 'tool_result': return { type: 'tool-result', toolResult: event.tool_result as any };
    case 'error': return { type: 'error', error: event.message as string };
    case 'done': return { type: 'done', usage: event.usage as any };
    default: return { type: 'text-delta', content: '' };
  }
}
```

---

## 3.3 Data Adapter (`busibox/data.ts`)

Wraps existing `lib/data/` CRUD operations. Maps the `DataAdapter` interface to Busibox data-api structured data endpoints.

```typescript
import type { DataAdapter, Filter, SortField, CollectionSchema, QueryResult } from '../../interfaces/data';

interface BusiboxDataConfig {
  dataApiUrl?: string;
  getToken: () => Promise<string>;
}

export class BusiboxDataAdapter implements DataAdapter {
  private baseUrl: string;
  private getToken: () => Promise<string>;

  constructor(config: BusiboxDataConfig) {
    this.baseUrl = config.dataApiUrl || process.env.DATA_API_URL || 'http://localhost:8002';
    this.getToken = config.getToken;
  }

  async query<T>(collection: string, params?: {
    filters?: Filter[];
    sort?: SortField[];
    limit?: number;
    offset?: number;
  }): Promise<QueryResult<T>> {
    // Maps to POST /data/{documentId}/query
    const token = await this.getToken();
    const response = await this.fetch(`/data/${collection}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filters: params?.filters?.map(f => ({
          field: f.field,
          operator: f.op,
          value: f.value,
        })),
        sort: params?.sort?.map(s => ({ field: s.field, order: s.direction })),
        limit: params?.limit,
        offset: params?.offset,
      }),
      token,
    });

    const data = await response.json();
    return { records: data.records as T[], total: data.total ?? data.records.length };
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const result = await this.query<T>(collection, {
      filters: [{ field: 'id', op: 'eq', value: id }],
      limit: 1,
    });
    return result.records[0] ?? null;
  }

  async insert(collection: string, records: Record<string, unknown>[]): Promise<string[]> {
    // Maps to POST /data/{documentId}/records
    const token = await this.getToken();
    const response = await this.fetch(`/data/${collection}/records`, {
      method: 'POST',
      body: JSON.stringify({ records }),
      token,
    });
    const data = await response.json();
    return data.ids ?? data.records?.map((r: any) => r.id) ?? [];
  }

  async update(collection: string, filters: Filter[], data: Record<string, unknown>): Promise<number> {
    // Maps to PUT /data/{documentId}/records
    const token = await this.getToken();
    const response = await this.fetch(`/data/${collection}/records`, {
      method: 'PUT',
      body: JSON.stringify({
        filters: filters.map(f => ({ field: f.field, operator: f.op, value: f.value })),
        data,
      }),
      token,
    });
    const result = await response.json();
    return result.count ?? result.modified ?? 0;
  }

  async delete(collection: string, filters: Filter[]): Promise<number> {
    // Maps to DELETE /data/{documentId}/records
    const token = await this.getToken();
    const response = await this.fetch(`/data/${collection}/records`, {
      method: 'DELETE',
      body: JSON.stringify({
        filters: filters.map(f => ({ field: f.field, operator: f.op, value: f.value })),
      }),
      token,
    });
    const result = await response.json();
    return result.count ?? result.deleted ?? 0;
  }

  async ensureCollection(collection: string, schema: CollectionSchema): Promise<void> {
    // Maps to POST /data (create document) + PUT /data/{documentId}/schema
    const token = await this.getToken();

    // Check if collection exists
    const existing = await this.fetch(`/data/${collection}`, { method: 'GET', token })
      .catch(() => null);

    if (!existing || !existing.ok) {
      // Create the collection
      await this.fetch('/data', {
        method: 'POST',
        body: JSON.stringify({
          id: collection,
          name: collection,
          schema: this.convertSchema(schema),
        }),
        token,
      });
    } else {
      // Update schema if it exists
      await this.fetch(`/data/${collection}/schema`, {
        method: 'PUT',
        body: JSON.stringify(this.convertSchema(schema)),
        token,
      });
    }
  }

  private async fetch(path: string, opts: { method: string; body?: string; token: string }) {
    const response = await globalThis.fetch(`${this.baseUrl}${path}`, {
      method: opts.method,
      headers: {
        'Authorization': `Bearer ${opts.token}`,
        'Content-Type': 'application/json',
      },
      body: opts.body,
    });
    if (!response.ok) {
      throw new Error(`Data API error: ${response.status} ${response.statusText} at ${opts.method} ${path}`);
    }
    return response;
  }

  private convertSchema(schema: CollectionSchema) {
    return {
      fields: schema.fields.map(f => ({
        name: f.name,
        type: f.type,
        nullable: f.nullable ?? false,
        primary_key: f.primaryKey ?? false,
        unique: f.unique ?? false,
        default: f.default,
      })),
      indexes: schema.indexes,
    };
  }
}
```

---

## 3.4 Search Adapter (`busibox/search.ts`)

Wraps `lib/search/client.ts` search operations.

```typescript
import type { SearchAdapter, SearchResult } from '../../interfaces/search';
import type { Filter } from '../../interfaces/data';

interface BusiboxSearchConfig {
  searchApiUrl?: string;
  getToken: () => Promise<string>;
}

export class BusiboxSearchAdapter implements SearchAdapter {
  private baseUrl: string;
  private getToken: () => Promise<string>;

  constructor(config: BusiboxSearchConfig) {
    this.baseUrl = config.searchApiUrl || process.env.SEARCH_API_URL || 'http://localhost:8003';
    this.getToken = config.getToken;
  }

  async search(params: {
    query: string;
    collections?: string[];
    mode?: 'hybrid' | 'semantic' | 'keyword';
    limit?: number;
    filters?: Filter[];
  }): Promise<SearchResult[]> {
    const token = await this.getToken();
    const endpoint = params.mode === 'keyword' ? '/search/keyword'
      : params.mode === 'semantic' ? '/search/semantic'
      : '/search';

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: params.query,
        libraries: params.collections,
        limit: params.limit ?? 10,
        filters: params.filters?.map(f => ({ field: f.field, operator: f.op, value: f.value })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.results ?? []).map((r: any) => ({
      id: r.id ?? r.chunk_id,
      collection: r.library_id ?? r.collection,
      content: r.content ?? r.text,
      score: r.score ?? r.relevance_score ?? 0,
      metadata: r.metadata,
    }));
  }

  async embed(texts: string[]): Promise<number[][]> {
    const token = await this.getToken();
    const embeddingUrl = process.env.EMBEDDING_API_URL || this.baseUrl.replace(':8003', ':8005');

    const response = await fetch(`${embeddingUrl}/embed`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ texts }),
    });

    if (!response.ok) throw new Error(`Embedding API error: ${response.status}`);
    const data = await response.json();
    return data.embeddings;
  }
}
```

---

## 3.5 Storage Adapter (`busibox/storage.ts`)

Wraps data-api file upload/download endpoints.

```typescript
import type { StorageAdapter, UploadResult } from '../../interfaces/storage';

interface BusiboxStorageConfig {
  dataApiUrl?: string;
  getToken: () => Promise<string>;
}

export class BusiboxStorageAdapter implements StorageAdapter {
  private baseUrl: string;
  private getToken: () => Promise<string>;

  constructor(config: BusiboxStorageConfig) {
    this.baseUrl = config.dataApiUrl || process.env.DATA_API_URL || 'http://localhost:8002';
    this.getToken = config.getToken;
  }

  async upload(file: File | Buffer | ReadableStream, options: {
    filename: string;
    contentType?: string;
    visibility?: 'private' | 'public';
    metadata?: Record<string, string>;
  }): Promise<UploadResult> {
    const token = await this.getToken();
    const formData = new FormData();

    if (file instanceof Buffer) {
      formData.append('file', new Blob([file], { type: options.contentType }), options.filename);
    } else if (file instanceof File) {
      formData.append('file', file);
    } else {
      // ReadableStream — collect into buffer
      const reader = file.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const blob = new Blob(chunks, { type: options.contentType });
      formData.append('file', blob, options.filename);
    }

    if (options.visibility) formData.append('visibility', options.visibility);
    if (options.metadata) formData.append('metadata', JSON.stringify(options.metadata));

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    const data = await response.json();

    return {
      id: data.file_id ?? data.id,
      url: data.url ?? `${this.baseUrl}/files/${data.file_id}/download`,
      size: data.size ?? 0,
      contentType: data.content_type ?? options.contentType ?? 'application/octet-stream',
    };
  }

  async download(id: string): Promise<ReadableStream> {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}/files/${id}/download`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    return response.body!;
  }

  async delete(id: string): Promise<void> {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}/files/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
  }

  async getUrl(id: string): Promise<string> {
    return `${this.baseUrl}/files/${id}/download`;
  }
}
```

---

## 3.6 Auth Adapter (`busibox/auth.ts`)

Wraps Zero Trust token exchange from `lib/authz/`.

```typescript
import type { AuthAdapter, PlatformUser, TokenClaims } from '../../interfaces/auth';

interface BusiboxAuthConfig {
  authzUrl?: string;
  sessionToken?: string | (() => Promise<string>);
}

export class BusiboxAuthAdapter implements AuthAdapter {
  private authzUrl: string;
  private getSessionToken: () => Promise<string>;

  constructor(config: BusiboxAuthConfig) {
    this.authzUrl = config.authzUrl || process.env.AUTHZ_BASE_URL || 'http://localhost:8010';
    this.getSessionToken = typeof config.sessionToken === 'function'
      ? config.sessionToken
      : async () => config.sessionToken as string;
  }

  async getCurrentUser(request: Request): Promise<PlatformUser | null> {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
      || this.extractCookie(request, 'busibox-session');

    if (!token) return null;

    const claims = await this.validateToken(token);
    if (!claims) return null;

    return {
      id: claims.sub,
      email: claims.email as string,
      name: claims.name as string,
      role: claims.role as string,
    };
  }

  async getServiceToken(audience: string): Promise<string> {
    const sessionJwt = await this.getSessionToken();
    // RFC 8693 token exchange
    const response = await fetch(`${this.authzUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: sessionJwt,
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        audience,
      }),
    });

    if (!response.ok) throw new Error(`Token exchange failed: ${response.status}`);
    const data = await response.json();
    return data.access_token;
  }

  async validateToken(token: string): Promise<TokenClaims | null> {
    try {
      // Fetch JWKS and validate locally
      const { jwtVerify, createRemoteJWKSet } = await import('jose');
      const JWKS = createRemoteJWKSet(new URL(`${this.authzUrl}/.well-known/jwks.json`));
      const { payload } = await jwtVerify(token, JWKS);
      return payload as TokenClaims;
    } catch {
      return null;
    }
  }

  async requireAuth(request: Request): Promise<PlatformUser> {
    const user = await this.getCurrentUser(request);
    if (!user) throw new Error('Unauthorized');
    return user;
  }

  private extractCookie(request: Request, name: string): string | null {
    const cookies = request.headers.get('cookie');
    if (!cookies) return null;
    const match = cookies.match(new RegExp(`${name}=([^;]+)`));
    return match?.[1] ?? null;
  }
}
```

---

## 3.7 Registration entry point (`busibox/index.ts`)

```typescript
import { registerAdapter } from '../../index';
import { BusiboxAIAdapter } from './ai';
import { BusiboxDataAdapter } from './data';
import { BusiboxSearchAdapter } from './search';
import { BusiboxStorageAdapter } from './storage';
import { BusiboxAuthAdapter } from './auth';

// Auto-register when this module is imported
const authAdapter = new BusiboxAuthAdapter({});

const getToken = (audience: string) => async () => {
  const token = await authAdapter.getServiceToken(audience);
  return token;
};

registerAdapter('busibox', 'ai', new BusiboxAIAdapter({ getToken: getToken('agent-api') }));
registerAdapter('busibox', 'data', new BusiboxDataAdapter({ getToken: getToken('data-api') }));
registerAdapter('busibox', 'search', new BusiboxSearchAdapter({ getToken: getToken('search-api') }));
registerAdapter('busibox', 'storage', new BusiboxStorageAdapter({ getToken: getToken('data-api') }));
registerAdapter('busibox', 'auth', authAdapter);

export { BusiboxAIAdapter, BusiboxDataAdapter, BusiboxSearchAdapter, BusiboxStorageAdapter, BusiboxAuthAdapter };
```

Consuming apps activate the adapter with a single import:

```typescript
// In app entry or layout
import '@jazzmind/busibox-app/platform/busibox';
import { getPlatform } from '@jazzmind/busibox-app/platform';

const { ai, data } = getPlatform(); // All Busibox adapters now active
```

---

## File changes summary

| File | Action |
|------|--------|
| `packages/app/src/platform/adapters/busibox/index.ts` | Create |
| `packages/app/src/platform/adapters/busibox/ai.ts` | Create |
| `packages/app/src/platform/adapters/busibox/data.ts` | Create |
| `packages/app/src/platform/adapters/busibox/search.ts` | Create |
| `packages/app/src/platform/adapters/busibox/storage.ts` | Create |
| `packages/app/src/platform/adapters/busibox/auth.ts` | Create |
| `packages/app/tests/adapters/busibox/ai.integration.test.ts` | Create |
| `packages/app/tests/adapters/busibox/data.integration.test.ts` | Create |
| `packages/app/tests/adapters/busibox/search.integration.test.ts` | Create |
| `packages/app/tests/adapters/busibox/storage.integration.test.ts` | Create |

---

## Anti-shortcut rules

- NEVER duplicate logic already in `lib/agent/`, `lib/data/`, `lib/search/`, `lib/authz/` — the adapter is a thin wrapper that delegates to existing code
- NEVER add new HTTP client libraries — use the global `fetch` API
- NEVER hardcode tokens or URLs — always read from config or environment
- NEVER cache tokens indefinitely — they have expiry times; respect TTLs from the token exchange response
- NEVER change the existing `lib/` module exports — the adapter wraps them, does not replace them
- NEVER make the adapter constructors require all config upfront — use lazy initialization from env vars as defaults

---

## Verification

1. `pnpm test:integration:busibox` passes all contract tests with a running Busibox stack
2. `BusiboxDataAdapter` can insert, query, update, delete records via data-api
3. `BusiboxAIAdapter.streamChat()` produces `StreamEvent` objects from agent-api SSE
4. `BusiboxAIAdapter.invoke()` returns structured output parsed by Zod schema
5. `BusiboxSearchAdapter.search()` returns scored results
6. `BusiboxStorageAdapter` upload/download cycle works
7. `BusiboxAuthAdapter.getServiceToken('agent-api')` returns a valid JWT
8. Existing apps (`@busibox/portal`, `@busibox/chat`, etc.) still compile and run unchanged
