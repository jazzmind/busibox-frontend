# Phase 1: Core Interfaces & Platform Configuration

## Objective

Define the abstract TypeScript interfaces for all platform services (AI, Data, Search, Storage, Auth) and the platform detection/factory system. This phase produces zero runtime behaviour — only types, interfaces, and the configuration layer that adapters will plug into.

## Gate condition

- All interface files compile with `tsc --noEmit`
- `getPlatform()` returns a `Platform` object with unimplemented stubs that throw "not configured"
- `detectPlatform()` correctly returns `'busibox'` when `AGENT_API_URL` is set, `'vercel'` when `DATABASE_URL` is set
- Subpath exports (`@jazzmind/busibox-app/platform`, `@jazzmind/busibox-app/platform/interfaces`) resolve correctly
- Existing `@jazzmind/busibox-app` consumers are unaffected (no breaking changes to current exports)

---

## 1.1 Interface definitions (`packages/app/src/platform/interfaces/`)

### AI Adapter (`ai.ts`)

```typescript
import type { ZodSchema } from 'zod';

export interface StreamEvent {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'error' | 'done';
  /** Incremental text chunk (type=text-delta) */
  content?: string;
  /** Tool call metadata (type=tool-call) */
  toolCall?: { id: string; name: string; args: Record<string, unknown> };
  /** Tool result (type=tool-result) */
  toolResult?: { id: string; result: unknown };
  /** Error message (type=error) */
  error?: string;
  /** Usage stats (type=done) */
  usage?: { inputTokens: number; outputTokens: number };
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  toolResults?: Array<{ id: string; result: unknown }>;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: ZodSchema;
}

export interface AgentDefinition {
  name: string;
  displayName: string;
  instructions: string;
  model?: string;
  tools?: string[];
  scopes?: string[];
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: ('chat' | 'structured' | 'vision' | 'tools')[];
}

export interface AIAdapter {
  streamChat(params: {
    messages: Message[];
    agent?: string;
    model?: string;
    tools?: ToolDef[];
    systemPrompt?: string;
  }): Promise<ReadableStream<StreamEvent>>;

  invoke<T>(params: {
    agent?: string;
    input: Record<string, unknown>;
    responseSchema: ZodSchema<T>;
    model?: string;
  }): Promise<T>;

  syncAgents?(definitions: AgentDefinition[]): Promise<void>;
  listModels?(): Promise<ModelInfo[]>;
}
```

### Data Adapter (`data.ts`)

```typescript
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
```

### Search Adapter (`search.ts`)

```typescript
export interface SearchResult {
  id: string;
  collection?: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface SearchAdapter {
  search(params: {
    query: string;
    collections?: string[];
    mode?: 'hybrid' | 'semantic' | 'keyword';
    limit?: number;
    filters?: Filter[];
  }): Promise<SearchResult[]>;

  embed?(texts: string[]): Promise<number[][]>;
}
```

### Storage Adapter (`storage.ts`)

```typescript
export interface UploadResult {
  id: string;
  url: string;
  size: number;
  contentType: string;
}

export interface StorageAdapter {
  upload(file: File | Buffer | ReadableStream, options: {
    filename: string;
    contentType?: string;
    visibility?: 'private' | 'public';
    metadata?: Record<string, string>;
  }): Promise<UploadResult>;

  download(id: string): Promise<ReadableStream>;
  delete(id: string): Promise<void>;
  getUrl(id: string, options?: { expiresIn?: number }): Promise<string>;
  list?(prefix?: string): Promise<Array<{ id: string; filename: string; size: number }>>;
}
```

### Auth Adapter (`auth.ts`)

```typescript
export interface PlatformUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  metadata?: Record<string, unknown>;
}

export interface TokenClaims {
  sub: string;
  aud?: string;
  exp: number;
  scopes?: string[];
  [key: string]: unknown;
}

export interface AuthAdapter {
  getCurrentUser(request: Request): Promise<PlatformUser | null>;
  getServiceToken?(audience: string): Promise<string>;
  validateToken?(token: string): Promise<TokenClaims | null>;
  requireAuth?(request: Request): Promise<PlatformUser>;
}
```

### Barrel (`index.ts`)

```typescript
export type { AIAdapter, StreamEvent, Message, ToolDef, AgentDefinition, ModelInfo } from './ai';
export type { DataAdapter, Filter, FilterOp, SortField, FieldDef, CollectionSchema, QueryResult } from './data';
export type { SearchAdapter, SearchResult } from './search';
export type { StorageAdapter, UploadResult } from './storage';
export type { AuthAdapter, PlatformUser, TokenClaims } from './auth';
```

---

## 1.2 Platform configuration (`packages/app/src/platform/config.ts`)

```typescript
export type PlatformType = 'busibox' | 'vercel' | 'aws' | 'azure';

export interface PlatformConfig {
  type: PlatformType;
  /** Override specific adapters (e.g., use Busibox auth but Vercel AI) */
  overrides?: {
    ai?: PlatformType;
    data?: PlatformType;
    search?: PlatformType;
    storage?: PlatformType;
    auth?: PlatformType;
  };
  /** Platform-specific configuration passed to adapters */
  options?: Record<string, unknown>;
}

export function detectPlatform(): PlatformType {
  if (process.env.BUSIBOX_PLATFORM) {
    return process.env.BUSIBOX_PLATFORM as PlatformType;
  }
  if (process.env.AGENT_API_URL || process.env.DATA_API_URL) return 'busibox';
  if (process.env.DATABASE_URL || process.env.VERCEL) return 'vercel';
  return 'vercel';
}

export function getPlatformConfig(): PlatformConfig {
  return {
    type: detectPlatform(),
    overrides: parseOverrides(),
    options: {},
  };
}

function parseOverrides(): PlatformConfig['overrides'] {
  const overrides: PlatformConfig['overrides'] = {};
  if (process.env.BUSIBOX_PLATFORM_AI) overrides.ai = process.env.BUSIBOX_PLATFORM_AI as PlatformType;
  if (process.env.BUSIBOX_PLATFORM_DATA) overrides.data = process.env.BUSIBOX_PLATFORM_DATA as PlatformType;
  if (process.env.BUSIBOX_PLATFORM_SEARCH) overrides.search = process.env.BUSIBOX_PLATFORM_SEARCH as PlatformType;
  if (process.env.BUSIBOX_PLATFORM_STORAGE) overrides.storage = process.env.BUSIBOX_PLATFORM_STORAGE as PlatformType;
  if (process.env.BUSIBOX_PLATFORM_AUTH) overrides.auth = process.env.BUSIBOX_PLATFORM_AUTH as PlatformType;
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}
```

---

## 1.3 Platform factory (`packages/app/src/platform/index.ts`)

```typescript
import type { AIAdapter } from './interfaces/ai';
import type { DataAdapter } from './interfaces/data';
import type { SearchAdapter } from './interfaces/search';
import type { StorageAdapter } from './interfaces/storage';
import type { AuthAdapter } from './interfaces/auth';
import { getPlatformConfig, type PlatformConfig, type PlatformType } from './config';

export interface Platform {
  readonly type: PlatformType;
  readonly ai: AIAdapter;
  readonly data: DataAdapter;
  readonly search: SearchAdapter;
  readonly storage: StorageAdapter;
  readonly auth: AuthAdapter;
}

let _instance: Platform | null = null;

export function getPlatform(): Platform {
  if (!_instance) {
    _instance = createPlatform(getPlatformConfig());
  }
  return _instance;
}

export function resetPlatform(): void {
  _instance = null;
}

export function createPlatform(config: PlatformConfig): Platform {
  const adapterType = (service: keyof NonNullable<PlatformConfig['overrides']>) =>
    config.overrides?.[service] ?? config.type;

  return {
    type: config.type,
    get ai() { return loadAdapter('ai', adapterType('ai'), config.options); },
    get data() { return loadAdapter('data', adapterType('data'), config.options); },
    get search() { return loadAdapter('search', adapterType('search'), config.options); },
    get storage() { return loadAdapter('storage', adapterType('storage'), config.options); },
    get auth() { return loadAdapter('auth', adapterType('auth'), config.options); },
  };
}

// Adapter registry — populated by adapter packages
const registry: Record<string, Record<string, unknown>> = {};

export function registerAdapter(platform: PlatformType, service: string, adapter: unknown): void {
  if (!registry[platform]) registry[platform] = {};
  registry[platform][service] = adapter;
}

function loadAdapter<T>(service: string, platform: PlatformType, options?: Record<string, unknown>): T {
  const adapter = registry[platform]?.[service];
  if (!adapter) {
    throw new Error(
      `No ${service} adapter registered for platform "${platform}". ` +
      `Import "@jazzmind/busibox-app/platform/${platform}" to register adapters.`
    );
  }
  return adapter as T;
}

// Re-export all interfaces
export * from './interfaces';
export { detectPlatform, type PlatformConfig, type PlatformType } from './config';
```

---

## 1.4 Package.json subpath exports (additions)

Add to `packages/app/package.json` `exports` field:

```json
"./platform": { "types": "./dist/platform/index.d.ts", "default": "./dist/platform/index.js" },
"./platform/interfaces": { "types": "./dist/platform/interfaces/index.d.ts", "default": "./dist/platform/interfaces/index.js" },
"./platform/busibox": { "types": "./dist/platform/adapters/busibox/index.d.ts", "default": "./dist/platform/adapters/busibox/index.js" },
"./platform/vercel": { "types": "./dist/platform/adapters/vercel/index.d.ts", "default": "./dist/platform/adapters/vercel/index.js" }
```

---

## File changes summary

| File | Action |
|------|--------|
| `packages/app/src/platform/index.ts` | Create |
| `packages/app/src/platform/config.ts` | Create |
| `packages/app/src/platform/interfaces/index.ts` | Create |
| `packages/app/src/platform/interfaces/ai.ts` | Create |
| `packages/app/src/platform/interfaces/data.ts` | Create |
| `packages/app/src/platform/interfaces/search.ts` | Create |
| `packages/app/src/platform/interfaces/storage.ts` | Create |
| `packages/app/src/platform/interfaces/auth.ts` | Create |
| `packages/app/package.json` | Update (add subpath exports) |

---

## Anti-shortcut rules

- NEVER put adapter implementation code in this phase — interfaces only
- NEVER add runtime dependencies — this phase is types + config (uses only `zod` which is already a dep)
- NEVER change existing exports — the new `./platform` export is additive only
- NEVER make `Platform` fields optional — each adapter service must always be present (throw if not registered)
- NEVER add platform-specific types (like Drizzle schemas or Anthropic SDK types) to the interfaces — they must remain platform-agnostic

---

## Verification

1. `cd packages/app && npx tsc --noEmit` passes
2. `import { getPlatform } from '@jazzmind/busibox-app/platform'` resolves in a consuming app
3. `import type { AIAdapter } from '@jazzmind/busibox-app/platform/interfaces'` resolves
4. `detectPlatform()` returns `'busibox'` when `AGENT_API_URL=http://localhost:8000`
5. `detectPlatform()` returns `'vercel'` when `DATABASE_URL=postgresql://...`
6. `getPlatform().ai.streamChat(...)` throws "No ai adapter registered for platform" (expected — no adapter loaded yet)
7. Existing apps importing `@jazzmind/busibox-app` or `@jazzmind/busibox-app/lib/agent` still compile without changes
