/**
 * Fetch wrapper that automatically prepends basePath to API routes
 * Always install - wraps Next.js's fetch wrapper
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

console.log('[api-url] Installing fetch wrapper, basePath:', BASE_PATH || '(none)');

const originalFetch = globalThis.fetch;

globalThis.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Handle different input types
  let url: string;
  
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.href;
  } else if (input instanceof Request) {
    url = input.url;
  } else {
    url = String(input);
  }
  
  // Debug logging for API calls
  // if (url.includes('/api/')) {
  //   console.log('[fetch wrapper]', { original: url, basePath: BASE_PATH || '(none)' });
  // }
  
  // Only modify URLs that:
  // 1. Have a basePath configured
  // 2. Start with /api (relative API routes)
  // 3. Don't already include the base path
  if (BASE_PATH && url.startsWith('/api') && !url.startsWith(BASE_PATH)) {
    url = `${BASE_PATH}${url}`;
    // console.log('[fetch wrapper] rewritten to:', url);
    
    // Create new Request object or URL string with modified path
    if (input instanceof Request) {
      input = new Request(url, input);
    } else if (input instanceof URL) {
      input = new URL(url, input);
    } else {
      input = url;
    }
  }
  
  return originalFetch.call(this, input, init);
};

// console.log('[api-url] Fetch wrapper installed');

/**
 * Helper to build an API URL manually (for cases where you need the URL but not fetching)
 */
export function apiUrl(path: string): string {
  if (BASE_PATH && path.startsWith('/api')) {
    return `${BASE_PATH}${path}`;
  }
  return path;
}

/**
 * Build a full absolute URL for server-side API calls
 */
export function absoluteApiUrl(path: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}${apiUrl(path)}`;
}

/**
 * Get the data-api URL for server-side calls.
 * Uses DATA_API_URL, or falls back to DATA_API_HOST/DATA_API_PORT.
 */
export function getDataApiUrl(): string {
  if (process.env.DATA_API_URL) {
    return process.env.DATA_API_URL;
  }
  const host = process.env.DATA_API_HOST || 'localhost';
  const port = process.env.DATA_API_PORT || '8002';
  return `http://${host}:${port}`;
}

/**
 * Get the search-api URL for server-side calls.
 * Uses SEARCH_API_URL, or falls back to SEARCH_API_HOST/SEARCH_API_PORT.
 */
export function getSearchApiUrl(): string {
  if (process.env.SEARCH_API_URL) {
    return process.env.SEARCH_API_URL;
  }
  const host = process.env.SEARCH_API_HOST || 'localhost';
  const port = process.env.SEARCH_API_PORT || '8003';
  return `http://${host}:${port}`;
}

/**
 * Get the deploy-api base URL for server-side calls.
 * Uses DEPLOY_API_URL, or falls back to DEPLOY_API_HOST/DEPLOY_API_PORT.
 *
 * NOTE: Do NOT use DEPLOYMENT_SERVICE_URL here — that includes a path suffix
 * (/api/v1/deployment) which causes double-pathing when the client appends
 * its own route paths like /api/v1/config.
 */
export function getDeployApiUrl(): string {
  if (process.env.DEPLOY_API_URL) {
    return process.env.DEPLOY_API_URL;
  }
  const host = process.env.DEPLOY_API_HOST || 'localhost';
  const port = process.env.DEPLOY_API_PORT || '8011';
  return `http://${host}:${port}`;
}

/**
 * Get the config-api URL for server-side calls.
 * Uses CONFIG_API_URL, or falls back to CONFIG_API_HOST/CONFIG_API_PORT.
 */
export function getConfigApiUrl(): string {
  if (process.env.CONFIG_API_URL) {
    return process.env.CONFIG_API_URL;
  }
  const host = process.env.CONFIG_API_HOST || 'localhost';
  const port = process.env.CONFIG_API_PORT || '8012';
  return `http://${host}:${port}`;
}

/**
 * Get the bridge-api URL for server-side calls.
 * Uses BRIDGE_API_URL or BRIDGE_API_HOST/BRIDGE_API_PORT environment variables.
 */
export function getBridgeApiUrl(): string {
  if (process.env.BRIDGE_API_URL) {
    return process.env.BRIDGE_API_URL;
  }
  const host = process.env.BRIDGE_API_HOST || 'localhost';
  const port = process.env.BRIDGE_API_PORT || '8081';
  return `http://${host}:${port}`;
}
