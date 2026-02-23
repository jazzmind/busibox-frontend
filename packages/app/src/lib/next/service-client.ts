/**
 * Service client helpers for calling downstream Busibox services.
 *
 * Provides utilities for:
 * - Obtaining authz-issued access tokens for specific services (Zero Trust)
 * - Making authenticated requests to data-api, search-api, agent-api
 * - Handling token caching and refresh
 *
 * Zero Trust Architecture:
 * - Requires session JWT for token exchange (cryptographic proof of identity)
 * - NO client credentials required for user operations
 */

import { getAuthorizationHeaderWithSession, type AuthzAudience } from '../authz/next-client';

export type ServiceName = 'data-api' | 'search-api' | 'agent-api';

export type ServiceClientOptions = {
  /** Session JWT from authz (required for Zero Trust) */
  sessionJwt: string;
  /** User ID */
  userId: string;
  /** Target service */
  service: ServiceName;
  /** OAuth2 scopes (optional) */
  scopes?: string[];
  /** Purpose label for audit/debug (optional) */
  purpose?: string;
};

/**
 * Get the base URL for a service from environment variables.
 */
export function getServiceBaseUrl(service: ServiceName): string {
  switch (service) {
    case 'data-api': {
      const host = process.env.DATA_API_HOST || '10.96.200.206';
      const port = process.env.DATA_API_PORT || '8002';
      return `http://${host}:${port}`;
    }
    case 'search-api': {
      const host = process.env.SEARCH_API_HOST || '10.96.200.204';
      const port = process.env.SEARCH_API_PORT || '8003';
      return `http://${host}:${port}`;
    }
    case 'agent-api': {
      const host = process.env.AGENT_API_HOST || '10.96.200.202';
      const port = process.env.AGENT_API_PORT || '8000';
      return `http://${host}:${port}`;
    }
  }
}

/**
 * Get default scopes for a service.
 * 
 * Note: Currently returns empty arrays because scopes are not enforced
 * by the downstream services. Authorization is handled via RBAC and
 * audience-bound tokens.
 */
export function getDefaultScopes(service: ServiceName): string[] {
  // Scopes are not currently enforced - return empty array
  // to avoid authz client scope validation errors
  return [];
}

/**
 * Create authenticated headers for calling a downstream service.
 *
 * This obtains an authz-issued access token and returns headers
 * suitable for fetch() calls.
 *
 * @example
 * ```typescript
 * const headers = await createServiceHeaders({
 *   userId: user.id,
 *   service: 'search-api',
 *   scopes: ['read'],
 * });
 *
 * const response = await fetch(`${getServiceBaseUrl('search-api')}/search`, {
 *   method: 'POST',
 *   headers,
 *   body: JSON.stringify({ query: 'example' }),
 * });
 * ```
 */
export async function createServiceHeaders(options: ServiceClientOptions): Promise<Record<string, string>> {
  const { sessionJwt, userId, service, scopes, purpose } = options;

  // Use Zero Trust token exchange (no client credentials)
  const authorization = await getAuthorizationHeaderWithSession({
    sessionJwt,
    userId,
    audience: service as AuthzAudience,
    scopes: scopes ?? getDefaultScopes(service),
    purpose: purpose ?? `busibox-portal.${service}`,
  });

  return {
    'Content-Type': 'application/json',
    Authorization: authorization,
  };
}

/**
 * Make an authenticated request to a downstream service.
 *
 * This is a convenience wrapper around fetch() that:
 * - Obtains an authz-issued access token
 * - Constructs the full URL
 * - Sets appropriate headers
 * - Returns the response
 *
 * @example
 * ```typescript
 * const response = await callService({
 *   userId: user.id,
 *   service: 'search-api',
 *   path: '/search',
 *   method: 'POST',
 *   body: { query: 'example' },
 * });
 *
 * if (!response.ok) {
 *   throw new Error(`Search failed: ${response.statusText}`);
 * }
 *
 * const data = await response.json();
 * ```
 */
export async function callService(
  options: ServiceClientOptions & {
    path: string;
    method?: string;
    body?: unknown;
    extraHeaders?: Record<string, string>;
  }
): Promise<Response> {
  const { sessionJwt, userId, service, scopes, purpose, path, method = 'GET', body, extraHeaders } =
    options;

  const baseUrl = getServiceBaseUrl(service);
  const url = `${baseUrl}${path}`;

  const headers = await createServiceHeaders({
    sessionJwt,
    userId,
    service,
    scopes,
    purpose,
  });

  // Merge extra headers
  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = JSON.stringify(body);
  }

  return fetch(url, fetchOptions);
}

/**
 * Legacy compatibility: create headers with X-User-Id.
 *
 * @deprecated Use createServiceHeaders() instead. This is only for
 * gradual migration of existing routes.
 */
export function createLegacyHeaders(userId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
  };
}

