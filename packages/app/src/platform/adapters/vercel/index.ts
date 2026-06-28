/**
 * Vercel platform adapter bundle.
 *
 * Importing this module registers all Vercel adapters with the platform registry.
 * Usage:
 *
 *   import '@jazzmind/busibox-app/platform/vercel';
 *   // or with custom config:
 *   import { registerVercelAdapters } from '@jazzmind/busibox-app/platform/vercel';
 *   registerVercelAdapters({ getSession: auth });
 */

import { registerAdapter } from '../../index';
import { VercelAIAdapter } from './ai';
import { VercelDataAdapter } from './data';
import { VercelSearchAdapter } from './search';
import { VercelStorageAdapter } from './storage';
import { VercelAuthAdapter } from './auth';

export { VercelAIAdapter } from './ai';
export { VercelDataAdapter } from './data';
export { VercelSearchAdapter } from './search';
export { VercelStorageAdapter } from './storage';
export { VercelAuthAdapter } from './auth';

export interface VercelAdapterConfig {
  /** Auth.js auth() function for session retrieval */
  getSession?: (request: Request) => Promise<{
    user?: { id?: string; email?: string | null; name?: string | null; role?: string } | null;
  } | null>;
  /** Override database URL (default: DATABASE_URL env var) */
  databaseUrl?: string;
  /** Vercel Blob token (default: BLOB_READ_WRITE_TOKEN env var) */
  blobToken?: string;
  /** AI provider: 'anthropic' | 'openai' (default: 'anthropic') */
  aiProvider?: 'anthropic' | 'openai';
  /** Model overrides */
  models?: { fast?: string; smart?: string };
}

/**
 * Register all Vercel adapters with the platform registry.
 */
export function registerVercelAdapters(config: VercelAdapterConfig = {}): void {
  registerAdapter('vercel', 'ai', new VercelAIAdapter({
    defaultProvider: config.aiProvider ?? 'anthropic',
    models: config.models,
  }));

  registerAdapter('vercel', 'data', new VercelDataAdapter({
    databaseUrl: config.databaseUrl,
  }));

  registerAdapter('vercel', 'search', new VercelSearchAdapter({
    databaseUrl: config.databaseUrl,
  }));

  registerAdapter('vercel', 'storage', new VercelStorageAdapter({
    token: config.blobToken,
  }));

  registerAdapter('vercel', 'auth', new VercelAuthAdapter({
    getSession: config.getSession,
  }));
}
