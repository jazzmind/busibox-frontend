/**
 * Deploy-API Client
 *
 * Server-side client for calling the deploy-api's deployment management endpoints.
 * Handles token exchange and typed HTTP requests.
 */

import { exchangeWithSubjectToken, type AuthzAudience } from '../authz/next-client';
import { getDeployApiUrl } from '../next/api-url';

// ============================================================================
// Token exchange
// ============================================================================

/**
 * Get a deploy-api scoped token via Zero Trust exchange.
 */
export async function getDeployApiToken(
  userId: string,
  sessionJwt: string,
): Promise<string> {
  const result = await exchangeWithSubjectToken({
    sessionJwt,
    userId,
    audience: 'deploy-api' as AuthzAudience,
    scopes: ['admin', 'deploy:write'],
    purpose: 'deploy-api-management',
  });
  if (!result.accessToken) {
    throw new Error('Failed to obtain deploy-api token');
  }
  return result.accessToken;
}

// ============================================================================
// Generic request helper
// ============================================================================

async function deployApiRequest<T = any>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${getDeployApiUrl()}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.detail || json.error || text;
    } catch { /* use raw text */ }
    const err = new Error(`deploy-api ${method} ${path} failed: ${resp.status} ${detail}`);
    (err as any).status = resp.status;
    throw err;
  }

  return resp.json();
}

// ============================================================================
// GitHub connection endpoints
// ============================================================================

export async function getGitHubAuthUrl(token: string) {
  return deployApiRequest<{ auth_url: string }>(token, 'GET', '/api/v1/github/auth-url');
}

export async function submitGitHubCallback(token: string, code: string, state?: string) {
  return deployApiRequest<{ success: boolean; connection: any }>(
    token, 'POST', '/api/v1/github/callback', { code, state },
  );
}

export async function getGitHubStatus(token: string) {
  return deployApiRequest<{
    connected: boolean;
    expired?: boolean;
    username?: string;
    scopes?: string[];
    connectedAt?: string;
  }>(token, 'GET', '/api/v1/github/status');
}

export async function disconnectGitHub(token: string) {
  return deployApiRequest<{ success: boolean }>(token, 'DELETE', '/api/v1/github/disconnect');
}

export async function reconnectGitHub(token: string) {
  return deployApiRequest<{ success: boolean; message: string; authUrl: string }>(
    token, 'POST', '/api/v1/github/reconnect',
  );
}

export async function verifyGitHubRepo(
  token: string,
  githubRepoOwner: string,
  githubRepoName: string,
) {
  return deployApiRequest<{
    verified: boolean;
    repository?: any;
    error?: string;
  }>(token, 'POST', '/api/v1/github/verify-repo', {
    github_repo_owner: githubRepoOwner,
    github_repo_name: githubRepoName,
  });
}

// ============================================================================
// Deployment config endpoints
// ============================================================================

export async function listDeploymentConfigs(token: string) {
  return deployApiRequest<{ configs: any[] }>(token, 'GET', '/api/v1/deployment-configs');
}

export async function createDeploymentConfig(token: string, data: {
  app_id: string;
  github_repo_owner: string;
  github_repo_name: string;
  github_branch?: string;
  deploy_path: string;
  port: number;
  health_endpoint?: string;
  build_command?: string;
  start_command?: string;
  auto_deploy_enabled?: boolean;
  staging_enabled?: boolean;
  staging_port?: number;
  staging_path?: string;
}) {
  return deployApiRequest<{ config: any }>(token, 'POST', '/api/v1/deployment-configs', data);
}

export async function getDeploymentConfig(token: string, configId: string) {
  return deployApiRequest<{ config: any }>(token, 'GET', `/api/v1/deployment-configs/${configId}`);
}

export async function updateDeploymentConfig(token: string, configId: string, data: Record<string, any>) {
  return deployApiRequest<{ config: any }>(token, 'PATCH', `/api/v1/deployment-configs/${configId}`, data);
}

export async function deleteDeploymentConfig(token: string, configId: string) {
  return deployApiRequest<{ success: boolean }>(token, 'DELETE', `/api/v1/deployment-configs/${configId}`);
}

export async function getNextPort(token: string) {
  return deployApiRequest<{ port: number }>(token, 'GET', '/api/v1/deployment-configs/helpers/next-port');
}

// ============================================================================
// Deployment history endpoints
// ============================================================================

export async function createDeployment(token: string, data: {
  deployment_config_id: string;
  deployed_by: string;
  environment?: string;
  deployment_type?: string;
  release_tag?: string;
  release_id?: string;
  commit_sha?: string;
  previous_deployment_id?: string;
  is_rollback?: boolean;
}) {
  return deployApiRequest<{ deployment: any }>(token, 'POST', '/api/v1/deployments', data);
}

export async function getDeployment(token: string, deploymentId: string) {
  return deployApiRequest<{ deployment: any }>(token, 'GET', `/api/v1/deployments/${deploymentId}`);
}

export async function updateDeployment(token: string, deploymentId: string, data: Record<string, any>) {
  return deployApiRequest<{ deployment: any }>(token, 'PATCH', `/api/v1/deployments/${deploymentId}`, data);
}

export async function rollbackDeployment(token: string, deploymentId: string) {
  return deployApiRequest<{ deployment: any }>(token, 'POST', `/api/v1/deployments/${deploymentId}/rollback`);
}

// ============================================================================
// Secrets endpoints
// ============================================================================

export async function listSecrets(token: string, configId: string) {
  return deployApiRequest<{ secrets: any[] }>(token, 'GET', `/api/v1/deployment-configs/${configId}/secrets`);
}

export async function upsertSecret(token: string, configId: string, data: {
  key: string;
  value: string;
  type?: string;
  description?: string;
}) {
  return deployApiRequest<{ secret: any }>(token, 'POST', `/api/v1/deployment-configs/${configId}/secrets`, data);
}

export async function deleteSecret(token: string, secretId: string) {
  return deployApiRequest<{ success: boolean }>(token, 'DELETE', `/api/v1/secrets/${secretId}`);
}

// ============================================================================
// Release endpoints
// ============================================================================

export async function listReleases(token: string, configId: string) {
  return deployApiRequest<{ releases: any[] }>(token, 'GET', `/api/v1/deployment-configs/${configId}/releases`);
}

export async function syncReleases(token: string, configId: string) {
  return deployApiRequest<{ success: boolean; count: number; releases: any[] }>(
    token, 'POST', `/api/v1/deployment-configs/${configId}/releases/sync`,
  );
}

// ============================================================================
// Config store endpoints (runtime configuration in deploy-api postgres)
// ============================================================================

export interface ConfigValue {
  key: string;
  value: string;
  encrypted: boolean;
  category?: string | null;
  description?: string | null;
}

export interface ConfigSetRequest {
  value: string;
  encrypted?: boolean;
  category?: string | null;
  description?: string | null;
}

export interface ConfigBulkSetRequest {
  configs: Record<string, ConfigSetRequest>;
}

export interface ConfigListResponse {
  configs: ConfigValue[];
  total: number;
}

/** List all config keys, optionally filtered by category. */
export async function listConfigs(token: string, category?: string) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return deployApiRequest<ConfigListResponse>(token, 'GET', `/api/v1/config${qs}`);
}

/** Get a single config value (masked if encrypted). */
export async function getConfig(token: string, key: string) {
  return deployApiRequest<ConfigValue>(token, 'GET', `/api/v1/config/${encodeURIComponent(key)}`);
}

/** Get the raw (unmasked) value for a config key. */
export async function getConfigRaw(token: string, key: string) {
  return deployApiRequest<{ key: string; value: string; encrypted: boolean }>(
    token, 'GET', `/api/v1/config/${encodeURIComponent(key)}/raw`,
  );
}

/** Set a single config value (upsert). */
export async function setConfig(token: string, key: string, data: ConfigSetRequest) {
  return deployApiRequest<ConfigValue>(
    token, 'PUT', `/api/v1/config/${encodeURIComponent(key)}`, data,
  );
}

/** Bulk-set multiple config values at once. */
export async function bulkSetConfigs(token: string, data: ConfigBulkSetRequest) {
  return deployApiRequest<ConfigListResponse>(token, 'POST', '/api/v1/config/bulk', data);
}

/** Delete a config key. */
export async function deleteConfig(token: string, key: string) {
  return deployApiRequest<{ deleted: boolean; key: string }>(
    token, 'DELETE', `/api/v1/config/${encodeURIComponent(key)}`,
  );
}

/**
 * Load all config values for a category using raw (unmasked) values.
 * Fetches the category listing first, then gets raw values for each key.
 */
export async function loadConfigCategoryRaw(
  token: string,
  category: string,
): Promise<Record<string, string>> {
  const listing = await listConfigs(token, category);
  const result: Record<string, string> = {};

  // Fetch raw (unmasked) values for each key
  for (const cfg of listing.configs) {
    try {
      const raw = await getConfigRaw(token, cfg.key);
      result[cfg.key] = raw.value;
    } catch {
      // If key disappeared or error, skip
    }
  }

  return result;
}

// ============================================================================
// Service management (restart / apply config)
// ============================================================================

/**
 * Trigger a bridge service restart via deploy-api.
 *
 * Docker: reads SMTP config from the config store, exports as compose env
 * vars, and recreates the bridge-api container via `docker compose up -d`.
 *
 * Proxmox: SSHs to the host and runs `make bridge` which re-renders
 * bridge.env.j2 from vault values and restarts the systemd service.
 */
export async function triggerBridgeRestart(token: string) {
  return deployApiRequest<{ success: boolean; message: string }>(
    token, 'POST', '/api/v1/config/apply/bridge',
  );
}

// ============================================================================
// App database endpoints
// ============================================================================

export async function getAppDatabase(token: string, configId: string) {
  return deployApiRequest<{ database: any }>(token, 'GET', `/api/v1/deployment-configs/${configId}/database`);
}

export async function provisionAppDatabase(token: string, configId: string, data: {
  database_name: string;
  database_user: string;
  password: string;
}) {
  return deployApiRequest<{ database: any }>(token, 'POST', `/api/v1/deployment-configs/${configId}/database`, data);
}

export async function deleteAppDatabase(token: string, configId: string) {
  return deployApiRequest<{ success: boolean }>(token, 'DELETE', `/api/v1/deployment-configs/${configId}/database`);
}
