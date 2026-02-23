/**
 * Search Provider Configuration API
 * 
 * Proxies to search-api's web-search admin endpoints.
 * 
 * GET /api/search-providers - List all provider configs
 * POST /api/search-providers - Create or update provider config
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getSearchApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';
import { clearSearchProviderCache } from '@jazzmind/busibox-app/lib/search/config';

async function getSearchApiToken(userId: string, sessionJwt: string): Promise<string> {
  const result = await exchangeWithSubjectToken({
    userId,
    sessionJwt,
    audience: 'search-api',
    purpose: 'admin-search-providers',
  });
  return result.accessToken;
}

async function searchApiRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getSearchApiUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`search-api ${response.status} ${path}: ${text}`);
  }
  return (await response.json()) as T;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user, sessionJwt } = authResult;

    const token = await getSearchApiToken(user.id, sessionJwt);
    const data = await searchApiRequest<{ providers?: Array<Record<string, unknown>> }>(
      token,
      '/web-search/providers'
    );

    const providers = data.providers || [];

    // Map search-api response shape to the format the frontend expects
    return apiSuccess({
      configs: providers.map((p: Record<string, unknown>) => ({
        id: p.id || p.provider,
        provider: p.provider,
        enabled: p.is_enabled ?? p.enabled ?? false,
        apiKey: p.api_key ? '***' : null, // Mask API key
        endpoint: p.endpoint || null,
        defaultProvider: p.is_default ?? p.defaultProvider ?? false,
        createdAt: p.created_at || p.createdAt || null,
        updatedAt: p.updated_at || p.updatedAt || null,
      })),
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[Search Providers] Error fetching configs:', err);
    return apiError(err?.message || 'Failed to fetch search provider configs', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user, sessionJwt } = authResult;

    const body = await request.json();
    const { provider, enabled, apiKey, endpoint, defaultProvider } = body;

    if (!provider || !['tavily', 'serpapi', 'perplexity', 'bing', 'duckduckgo'].includes(provider)) {
      return apiError('Invalid provider name', 400);
    }

    const token = await getSearchApiToken(user.id, sessionJwt);

    // If setting as default, use the dedicated default endpoint
    if (defaultProvider) {
      await searchApiRequest(token, `/web-search/admin/providers/${provider}/default`, {
        method: 'PUT',
      });
    }

    // Upsert the provider config
    const result = await searchApiRequest<Record<string, unknown>>(
      token,
      '/web-search/admin/providers',
      {
        method: 'POST',
        body: JSON.stringify({
          provider,
          is_enabled: enabled ?? false,
          api_key: apiKey || null,
          endpoint: endpoint || null,
          is_default: defaultProvider ?? false,
        }),
      }
    );

    // Clear cached search providers so the next request picks up the change
    clearSearchProviderCache();

    return apiSuccess({
      config: {
        id: result.id || provider,
        provider: result.provider || provider,
        enabled: result.is_enabled ?? enabled ?? false,
        apiKey: (result.api_key || apiKey) ? '***' : null,
        endpoint: result.endpoint || endpoint || null,
        defaultProvider: result.is_default ?? defaultProvider ?? false,
        createdAt: result.created_at || null,
        updatedAt: result.updated_at || null,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[Search Providers] Error updating config:', err);
    return apiError(err?.message || 'Failed to update search provider config', 500);
  }
}

