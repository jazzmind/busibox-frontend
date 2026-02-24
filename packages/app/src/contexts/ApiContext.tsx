'use client';

import * as React from 'react';

export type ServiceBaseUrls = {
  /** data-api base URL, e.g. http://localhost:8002 */
  dataApiUrl?: string;
  /** agent-api base URL, e.g. http://localhost:8000 */
  agentApiUrl?: string;
  /** search-api base URL, e.g. http://localhost:8003 */
  searchApiUrl?: string;
  /** videos service base URL (if separated), e.g. http://localhost:8010 */
  videoApiUrl?: string;
};

export type FallbackStrategy = {
  /**
   * Migration strategy: try service API first, fallback to Next.js routes.
   * This remains explicit and opt-in per call (see lib/http helpers).
   */
  mode: 'service-first-fallback-next';
  /** HTTP statuses that should trigger fallback */
  fallbackStatuses: number[];
  /** Whether network errors should trigger fallback */
  fallbackOnNetworkError: boolean;
};

export type CrossAppPaths = {
  /** Portal app base path, e.g. '/portal' — owns portal-customization, account */
  portal?: string;
  /** Documents app base path, e.g. '/documents' — owns libraries, data, documents, graph */
  documents?: string;
  /** Agents app base path, e.g. '/agents' — owns agents listing, agent proxy */
  agents?: string;
  /** Media app base path, e.g. '/media' — owns media file serving */
  media?: string;
  /** Chat app base path, e.g. '/chat' */
  chat?: string;
};

export type ApiDomain =
  | 'libraries'
  | 'data'
  | 'documents'
  | 'graph'
  | 'agents'
  | 'agent'
  | 'chat'
  | 'media'
  | 'videos'
  | 'portal-customization'
  | 'account';

const API_DOMAIN_OWNERS: Record<ApiDomain, keyof CrossAppPaths> = {
  libraries: 'documents',
  data: 'documents',
  documents: 'documents',
  graph: 'documents',
  agents: 'agents',
  agent: 'agents',
  chat: 'chat',
  media: 'media',
  videos: 'media',
  'portal-customization': 'portal',
  account: 'portal',
};

export type BusiboxApiConfig = {
  /**
   * Optional basePath prefix for Next.js API routes (e.g. when Next is deployed under /portal).
   * Example: basePath="/portal" means "/api/foo" becomes "/portal/api/foo".
   */
  nextApiBasePath?: string;
  /** Base paths for cross-app API calls through the nginx proxy */
  crossAppPaths?: CrossAppPaths;
  /** Base URLs for direct-to-service calls */
  services?: ServiceBaseUrls;
  /** Default headers appended to service requests (useful for bearer auth in other apps) */
  serviceRequestHeaders?: Record<string, string>;
  /** Default fallback behavior */
  fallback?: Partial<FallbackStrategy>;
};

const defaultFallback: FallbackStrategy = {
  mode: 'service-first-fallback-next',
  fallbackStatuses: [404, 405, 501, 502, 503, 504],
  fallbackOnNetworkError: true,
};

const ApiContext = React.createContext<BusiboxApiConfig>({
  nextApiBasePath: '',
  crossAppPaths: {},
  services: {},
  serviceRequestHeaders: {},
  fallback: defaultFallback,
});

export type BusiboxApiProviderProps = {
  value: BusiboxApiConfig;
  children: React.ReactNode;
};

export function BusiboxApiProvider({ value, children }: BusiboxApiProviderProps) {
  const merged: BusiboxApiConfig = React.useMemo(() => {
    return {
      nextApiBasePath: value.nextApiBasePath ?? '',
      crossAppPaths: value.crossAppPaths ?? {},
      services: value.services ?? {},
      serviceRequestHeaders: value.serviceRequestHeaders ?? {},
      fallback: { ...defaultFallback, ...(value.fallback ?? {}) },
    };
  }, [value]);

  return <ApiContext.Provider value={merged}>{children}</ApiContext.Provider>;
}

export function useBusiboxApi(): BusiboxApiConfig {
  return React.useContext(ApiContext);
}

/**
 * Returns the base path for a given cross-app target. Falls back to the
 * current app's nextApiBasePath when the target is the current app.
 */
export function useCrossAppBasePath(app: keyof CrossAppPaths): string {
  const config = React.useContext(ApiContext);
  return config.crossAppPaths?.[app] ?? config.nextApiBasePath ?? '';
}

/**
 * Resolves an API path like `/api/libraries` to the owning app's base path.
 * E.g. in the chat app, `/api/libraries` becomes `/documents/api/libraries`.
 */
export function resolveApiPath(domain: ApiDomain, path: string, config: BusiboxApiConfig): string {
  const ownerApp = API_DOMAIN_OWNERS[domain];
  const basePath = (config.crossAppPaths?.[ownerApp] ?? config.nextApiBasePath ?? '').replace(/\/+$/, '');
  if (!basePath) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}

/**
 * Hook that returns a resolver function bound to current config.
 * Usage: const resolve = useCrossAppApiPath();
 *        fetch(resolve('libraries', '/api/libraries'));
 */
export function useCrossAppApiPath() {
  const config = React.useContext(ApiContext);
  return React.useCallback(
    (domain: ApiDomain, path: string) => resolveApiPath(domain, path, config),
    [config]
  );
}










