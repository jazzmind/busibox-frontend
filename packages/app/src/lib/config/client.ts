/**
 * Config-API Client
 *
 * Server-side client for the centralised config-api service.
 * Handles token exchange and typed HTTP requests.
 */

import { exchangeWithSubjectToken, type AuthzAudience } from '../authz/next-client';
import { getConfigApiUrl } from '../next/api-url';

// ============================================================================
// Token exchange
// ============================================================================

export async function getConfigApiToken(
  userId: string,
  sessionJwt: string,
): Promise<string> {
  const result = await exchangeWithSubjectToken({
    sessionJwt,
    userId,
    audience: 'config-api' as AuthzAudience,
    purpose: 'config-api',
  });
  if (!result.accessToken) {
    throw new Error('Failed to obtain config-api token');
  }
  return result.accessToken;
}

// ============================================================================
// HTTP helpers
// ============================================================================

async function configApiRequest<T>(
  token: string | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${getConfigApiUrl()}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`config-api ${response.status} ${method} ${path}: ${text}`);
  }
  return (await response.json()) as T;
}

// ============================================================================
// Public endpoints (no auth required)
// ============================================================================

export interface BrandingConfig {
  companyName?: string;
  siteName?: string;
  slogan?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  addressCountry?: string;
  supportEmail?: string;
  supportPhone?: string;
  customCss?: string;
  setupComplete?: string;
}

export async function getBranding(): Promise<BrandingConfig> {
  const result = await configApiRequest<{ branding: Record<string, string> }>(null, 'GET', '/config/branding');
  return result.branding as BrandingConfig;
}

export async function getPublicConfig(): Promise<Record<string, string>> {
  const url = `${getConfigApiUrl()}/config/public`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`config-api ${response.status} GET /config/public: ${text}`);
  }
  const result = (await response.json()) as { config: Record<string, string> };
  return result.config;
}

// ============================================================================
// Authenticated endpoints
// ============================================================================

export interface AppRegistryEntry {
  id: string;
  name: string;
  description: string | null;
  type: string;
  ssoAudience: string | null;
  url: string | null;
  deployedPath: string | null;
  iconUrl: string | null;
  selectedIcon: string | null;
  displayOrder: number;
  isActive: boolean;
  healthEndpoint: string | null;
  githubRepo: string | null;
  deployedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  devMode: boolean;
  primaryColor: string | null;
  secondaryColor: string | null;
  lastDeploymentStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function listApps(token: string): Promise<AppRegistryEntry[]> {
  const result = await configApiRequest<{ apps: AppRegistryEntry[] }>(token, 'GET', '/config/apps');
  return result.apps;
}

export async function getApp(token: string, appId: string): Promise<AppRegistryEntry | null> {
  try {
    const result = await configApiRequest<{ app: AppRegistryEntry }>(token, 'GET', `/config/apps/${encodeURIComponent(appId)}`);
    return result.app;
  } catch {
    return null;
  }
}

// ============================================================================
// App-scoped endpoints (requires app access)
// ============================================================================

export async function getAppConfig(token: string, appId: string): Promise<Record<string, string>> {
  const result = await configApiRequest<{ config: Record<string, string> }>(
    token, 'GET', `/config/app/${encodeURIComponent(appId)}`,
  );
  return result.config;
}

export async function getAppConfigRaw(token: string, appId: string, key: string): Promise<string> {
  const result = await configApiRequest<{ key: string; value: string }>(
    token, 'GET', `/config/app/${encodeURIComponent(appId)}/${encodeURIComponent(key)}/raw`,
  );
  return result.value;
}

// ============================================================================
// Admin endpoints
// ============================================================================

export interface ConfigValue {
  key: string;
  value: string;
  encrypted: boolean;
  scope?: string;
  appId?: string | null;
  tier?: string;
  category?: string | null;
  description?: string | null;
}

export interface ConfigSetRequest {
  value: string;
  encrypted?: boolean;
  scope?: string;
  app_id?: string | null;
  tier?: string;
  category?: string | null;
  description?: string | null;
}

export interface ConfigListResponse {
  configs: ConfigValue[];
  total: number;
}

export async function listConfigs(token: string, category?: string): Promise<ConfigListResponse> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return configApiRequest<ConfigListResponse>(token, 'GET', `/admin/config${qs}`);
}

export async function getConfig(token: string, key: string): Promise<ConfigValue> {
  return configApiRequest<ConfigValue>(token, 'GET', `/admin/config/${encodeURIComponent(key)}`);
}

export async function getConfigRaw(token: string, key: string): Promise<{ key: string; value: string; encrypted: boolean }> {
  return configApiRequest(token, 'GET', `/admin/config/${encodeURIComponent(key)}/raw`);
}

export async function setConfig(token: string, key: string, data: ConfigSetRequest): Promise<ConfigValue> {
  return configApiRequest<ConfigValue>(token, 'PUT', `/admin/config/${encodeURIComponent(key)}`, data);
}

export async function deleteConfig(token: string, key: string): Promise<{ deleted: boolean; key: string }> {
  return configApiRequest(token, 'DELETE', `/admin/config/${encodeURIComponent(key)}`);
}

export async function bulkSetConfigs(
  token: string,
  payload: { configs: Record<string, ConfigSetRequest> },
): Promise<{ count: number }> {
  const items = Object.entries(payload.configs).map(([key, req]) => ({
    key,
    value: req.value,
    encrypted: req.encrypted ?? false,
    scope: req.scope ?? 'platform',
    app_id: req.app_id ?? null,
    tier: req.tier ?? 'admin',
    category: req.category ?? null,
    description: req.description ?? null,
  }));
  return configApiRequest<{ count: number }>(token, 'POST', '/admin/config/bulk', { configs: items });
}

export async function loadConfigCategoryRaw(
  token: string,
  category: string,
): Promise<Record<string, string>> {
  const listing = await listConfigs(token, category);
  const result: Record<string, string> = {};
  for (const cfg of listing.configs) {
    try {
      const raw = await getConfigRaw(token, cfg.key);
      result[cfg.key] = raw.value;
    } catch {
      // skip
    }
  }
  return result;
}

// Admin branding
export async function updateBranding(token: string, updates: Partial<BrandingConfig>): Promise<BrandingConfig> {
  const result = await configApiRequest<{ branding: BrandingConfig }>(token, 'PUT', '/admin/branding', updates);
  return result.branding;
}

// Admin app registry
export async function adminListApps(token: string): Promise<AppRegistryEntry[]> {
  const result = await configApiRequest<{ apps: AppRegistryEntry[] }>(token, 'GET', '/admin/apps');
  return result.apps;
}

export async function adminCreateApp(token: string, data: Partial<AppRegistryEntry> & { id: string; name: string }): Promise<AppRegistryEntry> {
  const result = await configApiRequest<{ app: AppRegistryEntry }>(token, 'POST', '/admin/apps', data);
  return result.app;
}

export async function adminUpdateApp(token: string, appId: string, updates: Partial<AppRegistryEntry>): Promise<AppRegistryEntry> {
  const result = await configApiRequest<{ app: AppRegistryEntry }>(token, 'PUT', `/admin/apps/${encodeURIComponent(appId)}`, updates);
  return result.app;
}

export async function adminDeleteApp(token: string, appId: string): Promise<boolean> {
  const result = await configApiRequest<{ deleted: boolean }>(token, 'DELETE', `/admin/apps/${encodeURIComponent(appId)}`);
  return result.deleted;
}

export async function adminReorderApps(token: string, updates: Array<{ id: string; displayOrder: number }>): Promise<number> {
  const result = await configApiRequest<{ updated: number }>(token, 'PUT', '/admin/apps/reorder', { updates });
  return result.updated;
}
