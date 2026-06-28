import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPlatform,
  resetPlatform,
  createPlatform,
  registerAdapter,
  type Platform,
} from '../../../src/platform/index';
import { MemoryAIAdapter } from '../adapters/memory/ai';
import { MemoryDataAdapter } from '../adapters/memory/data';
import { MemorySearchAdapter } from '../adapters/memory/search';
import { MemoryStorageAdapter } from '../adapters/memory/storage';
import { MemoryAuthAdapter } from '../adapters/memory/auth';

describe('registerAdapter + createPlatform', () => {
  beforeEach(() => {
    resetPlatform();
  });

  afterEach(() => {
    resetPlatform();
  });

  it('throws when no adapters are registered', () => {
    const platform = createPlatform({ type: 'vercel' });
    expect(() => platform.ai).toThrow(/No ai adapter registered for platform "vercel"/);
  });

  it('throws with helpful error message including import hint', () => {
    const platform = createPlatform({ type: 'busibox' });
    expect(() => platform.data).toThrow(
      /@jazzmind\/busibox-app\/platform\/busibox/,
    );
  });

  it('returns registered adapter when accessed', () => {
    const aiAdapter = new MemoryAIAdapter();
    registerAdapter('vercel', 'ai', aiAdapter);

    const platform = createPlatform({ type: 'vercel' });
    expect(platform.ai).toBe(aiAdapter);
  });

  it('supports per-service overrides', () => {
    const busiboxAI = new MemoryAIAdapter();
    const vercelData = new MemoryDataAdapter();
    registerAdapter('busibox', 'ai', busiboxAI);
    registerAdapter('vercel', 'data', vercelData);

    const platform = createPlatform({
      type: 'busibox',
      overrides: { data: 'vercel' },
    });

    expect(platform.ai).toBe(busiboxAI);
    expect(platform.data).toBe(vercelData);
  });
});

describe('getPlatform singleton', () => {
  beforeEach(() => {
    resetPlatform();
    // Register all memory adapters for the default platform type
    registerAdapter('vercel', 'ai', new MemoryAIAdapter());
    registerAdapter('vercel', 'data', new MemoryDataAdapter());
    registerAdapter('vercel', 'search', new MemorySearchAdapter());
    registerAdapter('vercel', 'storage', new MemoryStorageAdapter());
    registerAdapter('vercel', 'auth', new MemoryAuthAdapter());
    // Set platform to vercel for these tests
    process.env.BUSIBOX_PLATFORM = 'vercel';
  });

  afterEach(() => {
    resetPlatform();
    delete process.env.BUSIBOX_PLATFORM;
  });

  it('returns the same instance on repeated calls', () => {
    const p1 = getPlatform();
    const p2 = getPlatform();
    expect(p1).toBe(p2);
  });

  it('returns a new instance after resetPlatform()', () => {
    const p1 = getPlatform();
    resetPlatform();
    registerAdapter('vercel', 'ai', new MemoryAIAdapter());
    registerAdapter('vercel', 'data', new MemoryDataAdapter());
    registerAdapter('vercel', 'search', new MemorySearchAdapter());
    registerAdapter('vercel', 'storage', new MemoryStorageAdapter());
    registerAdapter('vercel', 'auth', new MemoryAuthAdapter());
    const p2 = getPlatform();
    expect(p1).not.toBe(p2);
  });

  it('platform.type matches detected platform type', () => {
    const platform = getPlatform();
    expect(platform.type).toBe('vercel');
  });

  it('all services are accessible', () => {
    const platform = getPlatform();
    expect(platform.ai).toBeDefined();
    expect(platform.data).toBeDefined();
    expect(platform.search).toBeDefined();
    expect(platform.storage).toBeDefined();
    expect(platform.auth).toBeDefined();
  });
});
