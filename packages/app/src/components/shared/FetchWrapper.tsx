'use client';

import { useEffect, useRef } from 'react';
import { getGlobalAuthManager, isAuthInitializing } from '../../lib/authz/auth-state-manager';

export type FetchWrapperProps = {
  /**
   * Callback when a 401 response is received and token refresh fails.
   * If not provided, the global auth manager will handle it.
   */
  onAuthError?: (response: Response) => void;

  /**
   * Whether to automatically retry requests after token refresh.
   * Default: true
   */
  autoRetry?: boolean;

  /**
   * URLs to skip 401 handling for (e.g., login endpoints).
   */
  skipAuthUrls?: string[];
};

/**
 * Client-only helper that installs a browser fetch() wrapper.
 *
 * Current behavior:
 * - If NEXT_PUBLIC_BASE_PATH is set, rewrites client calls from `/api/...` -> `${BASE_PATH}/api/...`
 * - Leaves absolute URLs and non-`/api` paths untouched.
 * - Intercepts 401 responses and triggers token refresh via auth state manager
 * - Automatically retries failed requests after successful token refresh
 */
export function FetchWrapper({ 
  onAuthError, 
  autoRetry = true,
  skipAuthUrls = ['/api/auth/refresh', '/api/auth/session', '/api/session', '/api/logout'],
}: FetchWrapperProps = {}) {
  const originalFetchRef = useRef<typeof window.fetch | null>(null);

  useEffect(() => {
    const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

    // Store original fetch only once
    if (!originalFetchRef.current) {
      originalFetchRef.current = window.fetch.bind(window);
    }
    const originalFetch = originalFetchRef.current;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
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

      const originalUrl = url;

      // Only modify URLs that:
      // 1. Have a basePath configured
      // 2. Start with /api (relative API routes)
      // 3. Don't already include the base path
      if (BASE_PATH && url.startsWith('/api') && !url.startsWith(BASE_PATH)) {
        url = `${BASE_PATH}${url}`;

        // Create new Request object or URL string with modified path
        if (input instanceof Request) {
          input = new Request(url, input);
        } else if (input instanceof URL) {
          input = new URL(url, input);
        } else {
          input = url;
        }
      }

      // Ensure credentials are included for all API calls to send cookies
      if (!init) {
        init = {};
      }
      if (init.credentials === undefined) {
        init.credentials = 'include';
      }

      // Make the request
      const response = await originalFetch.call(window, input, init);

      // Handle 401 responses
      if (response.status === 401) {
        // Skip auth handling for certain URLs
        const shouldSkip = skipAuthUrls.some(skipUrl => 
          originalUrl.includes(skipUrl) || url.includes(skipUrl)
        );

        // Also skip if auth is initializing (token exchange in progress)
        // In this case, just return the 401 without triggering redirects
        if (isAuthInitializing()) {
          console.log('[FetchWrapper] Received 401 but auth is initializing, skipping redirect');
          return response;
        }

        if (!shouldSkip) {
          console.log('[FetchWrapper] Received 401 response for:', originalUrl);

          // Try to get the auth manager
          const authManager = getGlobalAuthManager();

          if (authManager) {
            // Let the auth manager handle the 401 - try refresh first
            const refreshed = await authManager.handle401Response();

            if (refreshed && autoRetry) {
              // Retry the original request with new credentials
              console.log('[FetchWrapper] Retrying request after token refresh');
              const retryResponse = await originalFetch.call(window, input, init);
              // If retry ALSO gets 401, the refresh didn't actually help.
              // Notify the auth manager so it can track the failure and eventually redirect.
              if (retryResponse.status === 401) {
                console.log('[FetchWrapper] Retry still got 401 - refresh did not help');
                authManager.handle401Response(); // Will increment counter and eventually redirect
              }
              return retryResponse;
            }
            // If refresh failed, handle401Response already triggers redirect
          } else if (onAuthError) {
            // Custom handler
            onAuthError(response);
          }
          // If no auth manager and no onAuthError, just return the 401
        }
      }

      return response;
    };

    // Cleanup: restore original fetch on unmount
    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
      }
    };
  }, [onAuthError, autoRetry, skipAuthUrls]);

  return null;
}








