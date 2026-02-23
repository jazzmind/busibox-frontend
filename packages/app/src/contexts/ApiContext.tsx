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

export type BusiboxApiConfig = {
  /**
   * Optional basePath prefix for Next.js API routes (e.g. when Next is deployed under /portal).
   * Example: basePath="/portal" means "/api/foo" becomes "/portal/api/foo".
   */
  nextApiBasePath?: string;
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










