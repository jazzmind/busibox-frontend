/**
 * Busibox platform adapter bundle.
 *
 * Importing this module registers all Busibox adapters with the platform registry.
 * Usage:
 *
 *   import '@jazzmind/busibox-app/platform/busibox';
 *   // or with a custom getToken:
 *   import { registerBusiboxAdapters } from '@jazzmind/busibox-app/platform/busibox';
 *   registerBusiboxAdapters({ getToken: () => Promise.resolve(sessionToken) });
 */

import { registerAdapter } from '../../index';
import { BusiboxAIAdapter } from './ai';
import { BusiboxDataAdapter } from './data';
import { BusiboxSearchAdapter } from './search';
import { BusiboxStorageAdapter } from './storage';
import { BusiboxAuthAdapter } from './auth';

export { BusiboxAIAdapter } from './ai';
export { BusiboxDataAdapter } from './data';
export { BusiboxSearchAdapter } from './search';
export { BusiboxStorageAdapter } from './storage';
export { BusiboxAuthAdapter } from './auth';

export interface BusiboxAdapterConfig {
  /** Returns the current user's JWT for service-to-service calls */
  getToken: () => Promise<string>;
  /** Custom Authz base URL (default: AUTHZ_BASE_URL env var) */
  authzBaseUrl?: string;
  /** Custom Agent API URL (default: AGENT_API_URL env var) */
  agentApiUrl?: string;
  /** Custom Data API URL (default: DATA_API_HOST/PORT env vars) */
  dataApiUrl?: string;
  /** Custom Search API URL (default: SEARCH_API_URL env var) */
  searchApiUrl?: string;
  /** How to get the session JWT from a request for auth (default: Authorization header) */
  getSessionToken?: (request: Request) => Promise<string | null>;
}

/**
 * Register all Busibox adapters with the platform registry.
 * Call this once during app startup (e.g. in your middleware or root layout).
 */
export function registerBusiboxAdapters(config: BusiboxAdapterConfig): void {
  const getSessionToken =
    config.getSessionToken ??
    ((req: Request) => {
      const auth = req.headers.get('Authorization');
      return Promise.resolve(auth?.startsWith('Bearer ') ? auth.slice(7) : null);
    });

  registerAdapter('busibox', 'ai', new BusiboxAIAdapter({
    agentApiUrl: config.agentApiUrl,
    getToken: config.getToken,
  }));

  registerAdapter('busibox', 'data', new BusiboxDataAdapter({
    dataApiUrl: config.dataApiUrl,
    getToken: config.getToken,
  }));

  registerAdapter('busibox', 'search', new BusiboxSearchAdapter({
    searchApiUrl: config.searchApiUrl,
    getToken: config.getToken,
  }));

  registerAdapter('busibox', 'storage', new BusiboxStorageAdapter({
    dataApiUrl: config.dataApiUrl,
    getToken: config.getToken,
  }));

  registerAdapter('busibox', 'auth', new BusiboxAuthAdapter({
    authzBaseUrl: config.authzBaseUrl,
    getSessionToken,
  }));
}

// Auto-register with environment-based defaults when imported directly.
// This path is only taken if AGENT_API_URL or DATA_API_URL are set,
// meaning we're actually running in a Busibox environment.
if (
  typeof process !== 'undefined' &&
  (process.env.AGENT_API_URL || process.env.DATA_API_URL)
) {
  registerBusiboxAdapters({
    // In auto-registration mode, token is extracted from each request at runtime.
    // Apps that need a different strategy should call registerBusiboxAdapters() directly.
    getToken: () => Promise.reject(new Error(
      'Busibox adapter requires a getToken function. ' +
      'Call registerBusiboxAdapters({ getToken: ... }) instead of importing the bundle directly.'
    )),
  });
}
