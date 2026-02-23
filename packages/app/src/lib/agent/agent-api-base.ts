/**
 * Agent API Base Client
 *
 * Single source of truth for agent-api URL resolution, authentication,
 * timeout handling, and error parsing. All domain-specific clients
 * (server-client, chat-api-client, chat-client) delegate here.
 *
 * The agent API runs on port 8000 (FastAPI/uvicorn).
 */

import { exchangeTokenZeroTrust } from '../authz/zero-trust';

// ---------------------------------------------------------------------------
// URL Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the agent API base URL at runtime.
 *
 * Server-side priority: AGENT_API_URL > AGENT_API_HOST:PORT > http://agent-api:8000
 * Client-side: NEXT_PUBLIC_AGENT_API_URL > /api/agent (proxy via Next.js)
 */
export function getAgentApiUrl(): string {
  if (typeof window === 'undefined') {
    const url = process.env.AGENT_API_URL;
    if (url) {
      if (process.env.VERBOSE_AUTHZ_LOGGING === 'true') {
        console.log(`[AGENT-API] Using AGENT_API_URL: ${url}`);
      }
      return url;
    }

    const host = process.env.AGENT_API_HOST;
    const port = process.env.AGENT_API_PORT || '8000';
    if (host) {
      const hostUrl = `http://${host}:${port}`;
      if (process.env.VERBOSE_AUTHZ_LOGGING === 'true') {
        console.log(`[AGENT-API] Using AGENT_API_HOST:PORT: ${hostUrl}`);
      }
      return hostUrl;
    }

    if (process.env.VERBOSE_AUTHZ_LOGGING === 'true') {
      console.log(`[AGENT-API] Using default: http://agent-api:8000`);
    }
    return 'http://agent-api:8000';
  }

  console.warn('[AGENT-API] Client-side call detected - should use Next.js API routes instead');
  return process.env.NEXT_PUBLIC_AGENT_API_URL || '/api/agent';
}

// ---------------------------------------------------------------------------
// Auth headers
// ---------------------------------------------------------------------------

export function buildAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

/**
 * Exchange a session JWT for an agent-api access token via Zero Trust.
 */
export async function getAgentApiToken(userId: string, sessionJwt: string): Promise<string> {
  const result = await exchangeTokenZeroTrust(
    {
      sessionJwt,
      audience: 'agent-api',
      purpose: 'chat-operations',
    },
    {
      authzBaseUrl: process.env.AUTHZ_BASE_URL || 'http://authz-api:8010',
      verbose: process.env.VERBOSE_AUTHZ_LOGGING === 'true',
    }
  );
  return result.accessToken;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export interface AgentApiFetchOptions extends RequestInit {
  /** Bearer token for Authorization header */
  token?: string;
  /** Request timeout in milliseconds (default 30000) */
  timeout?: number;
  /** External AbortSignal for caller-controlled cancellation */
  signal?: AbortSignal | null;
}

/**
 * Low-level fetch against the agent API. Returns the raw Response so
 * callers can handle streaming (SSE), 204 no-content, etc.
 */
export async function agentApiFetch(
  path: string,
  options: AgentApiFetchOptions = {},
): Promise<Response> {
  const { token, timeout = 30000, signal: externalSignal, ...fetchOptions } = options;

  const baseUrl = getAgentApiUrl();
  const url = path.startsWith('http')
    ? path
    : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  if (externalSignal && typeof externalSignal.addEventListener === 'function') {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    const headers: Record<string, string> = {
      ...buildAuthHeaders(token),
      ...(fetchOptions.headers as Record<string, string> | undefined),
    };

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');

      let errorMessage = `Agent API error (${response.status}): ${errorBody}`;
      try {
        const parsed = JSON.parse(errorBody);
        if (typeof parsed.detail === 'string') errorMessage = parsed.detail;
        else if (typeof parsed.error === 'string') errorMessage = parsed.error;
        else if (typeof parsed.message === 'string') errorMessage = parsed.message;
        else if (parsed.detail && typeof parsed.detail === 'object') errorMessage = JSON.stringify(parsed.detail);
        else if (parsed.error && typeof parsed.error === 'object') errorMessage = JSON.stringify(parsed.error);
      } catch {
        // errorBody wasn't JSON – keep the text version
      }

      const err = new Error(errorMessage);
      (err as any).status = response.status;
      throw err;
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (externalSignal && 'aborted' in externalSignal && externalSignal.aborted) {
        const abortError = new Error('Request cancelled');
        abortError.name = 'AbortError';
        throw abortError;
      }
      throw new Error('Agent API request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch JSON from the agent API with automatic 204 handling.
 *
 * For endpoints that return 204 No Content, returns `undefined`.
 */
export async function agentApiFetchJson<T>(
  path: string,
  options: AgentApiFetchOptions = {},
): Promise<T> {
  const response = await agentApiFetch(path, options);

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
