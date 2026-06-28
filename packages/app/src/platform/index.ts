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
    get ai() { return loadAdapter<AIAdapter>('ai', adapterType('ai')); },
    get data() { return loadAdapter<DataAdapter>('data', adapterType('data')); },
    get search() { return loadAdapter<SearchAdapter>('search', adapterType('search')); },
    get storage() { return loadAdapter<StorageAdapter>('storage', adapterType('storage')); },
    get auth() { return loadAdapter<AuthAdapter>('auth', adapterType('auth')); },
  };
}

// Adapter registry — populated by adapter packages via registerAdapter()
const registry: Record<string, Record<string, unknown>> = {};

export function registerAdapter(platform: PlatformType, service: string, adapter: unknown): void {
  if (!registry[platform]) registry[platform] = {};
  registry[platform][service] = adapter;
}

function loadAdapter<T>(service: string, platform: PlatformType): T {
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
export { detectPlatform, getPlatformConfig, type PlatformConfig, type PlatformType } from './config';
