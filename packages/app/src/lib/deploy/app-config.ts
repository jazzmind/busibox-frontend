/**
 * App Config Store — backed by config-api.
 *
 * This module provides the same exported interface as the previous data-api–backed
 * implementation, but delegates all storage to the config-api service.
 */

import {
  getConfigApiToken,
  listApps as configListApps,
  getApp as configGetApp,
  adminCreateApp,
  adminUpdateApp,
  adminDeleteApp,
  adminReorderApps,
  type AppRegistryEntry,
} from '../config/client';

export type AppConfigType = 'BUILT_IN' | 'LIBRARY' | 'EXTERNAL' | 'INTERNAL';

export type AppConfigRecord = {
  id: string;
  name: string;
  ssoAudience: string | null;
  description: string | null;
  type: AppConfigType;
  url: string | null;
  deployedPath: string | null;
  iconUrl: string | null;
  selectedIcon: string | null;
  displayOrder: number;
  isActive: boolean;
  healthEndpoint: string | null;
  oauthClientSecret: string | null;
  githubToken: string | null;
  githubRepo: string | null;
  lastDeploymentId: string | null;
  lastDeploymentStatus: string | null;
  lastDeploymentLogs: string | null;
  lastDeploymentStartedAt: Date | null;
  lastDeploymentEndedAt: Date | null;
  lastDeploymentError: string | null;
  deployedVersion: string | null;
  latestVersion: string | null;
  latestVersionCheckedAt: Date | null;
  updateAvailable: boolean;
  devMode: boolean;
  primaryColor: string | null;
  secondaryColor: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AppConfigCreateInput = Omit<AppConfigRecord, 'createdAt' | 'updatedAt'> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export type AppConfigUpdateInput = Partial<Omit<AppConfigRecord, 'id' | 'createdAt' | 'updatedAt'>> & {
  updatedAt?: Date;
};

export type AppConfigStoreContext = {
  accessToken: string;
  roleIds: string[];
};

// ============================================================================
// Helpers
// ============================================================================

function sanitizeAudienceSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractRepoName(githubRepo: string): string | null {
  const trimmed = githubRepo.trim().replace(/\.git$/, '');
  if (!trimmed) return null;
  const parts = trimmed.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

export function resolveStableSsoAudience(input: {
  id: string;
  name: string;
  deployedPath?: string | null;
  url?: string | null;
  githubRepo?: string | null;
  ssoAudience?: string | null;
}): string {
  const explicit = typeof input.ssoAudience === 'string' ? sanitizeAudienceSegment(input.ssoAudience) : '';
  if (explicit) return explicit;

  if (typeof input.githubRepo === 'string' && input.githubRepo.trim()) {
    const repoName = extractRepoName(input.githubRepo);
    if (repoName) {
      const audience = sanitizeAudienceSegment(repoName);
      if (audience) return audience;
    }
  }

  if (typeof input.deployedPath === 'string' && input.deployedPath.trim()) {
    const audience = sanitizeAudienceSegment(input.deployedPath.replace(/^\//, ''));
    if (audience) return audience;
  }

  if (typeof input.url === 'string' && input.url.trim()) {
    if (input.url.startsWith('/')) {
      const audience = sanitizeAudienceSegment(input.url.replace(/^\//, ''));
      if (audience) return audience;
    }
  }

  const fromName = sanitizeAudienceSegment(input.name);
  if (fromName) return fromName;

  return sanitizeAudienceSegment(input.id) || `app-${crypto.randomUUID()}`;
}

function registryToRecord(entry: AppRegistryEntry): AppConfigRecord {
  const now = new Date();
  return {
    id: entry.id,
    name: entry.name,
    ssoAudience: entry.ssoAudience ?? null,
    description: entry.description ?? null,
    type: (entry.type as AppConfigType) || 'LIBRARY',
    url: entry.url ?? null,
    deployedPath: entry.deployedPath ?? null,
    iconUrl: entry.iconUrl ?? null,
    selectedIcon: entry.selectedIcon ?? null,
    displayOrder: entry.displayOrder ?? 0,
    isActive: entry.isActive ?? true,
    healthEndpoint: entry.healthEndpoint ?? null,
    oauthClientSecret: null,
    githubToken: null,
    githubRepo: entry.githubRepo ?? null,
    lastDeploymentId: null,
    lastDeploymentStatus: null,
    lastDeploymentLogs: null,
    lastDeploymentStartedAt: null,
    lastDeploymentEndedAt: null,
    lastDeploymentError: null,
    deployedVersion: entry.deployedVersion ?? null,
    latestVersion: entry.latestVersion ?? null,
    latestVersionCheckedAt: null,
    updateAvailable: entry.updateAvailable ?? false,
    devMode: entry.devMode ?? false,
    primaryColor: entry.primaryColor ?? null,
    secondaryColor: entry.secondaryColor ?? null,
    createdAt: entry.createdAt ? new Date(entry.createdAt) : now,
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : now,
  };
}

function recordToRegistryInput(record: AppConfigRecord): Record<string, unknown> {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    type: record.type,
    ssoAudience: record.ssoAudience,
    url: record.url,
    deployedPath: record.deployedPath,
    iconUrl: record.iconUrl,
    selectedIcon: record.selectedIcon,
    displayOrder: record.displayOrder,
    isActive: record.isActive,
    healthEndpoint: record.healthEndpoint,
    githubRepo: record.githubRepo,
    deployedVersion: record.deployedVersion,
    latestVersion: record.latestVersion,
    updateAvailable: record.updateAvailable,
    devMode: record.devMode,
    primaryColor: record.primaryColor,
    secondaryColor: record.secondaryColor,
  };
}

// ============================================================================
// Store context
// ============================================================================

export async function getAppConfigStoreContextForUser(
  userId: string,
  sessionJwt: string,
): Promise<AppConfigStoreContext & { sessionJwt: string }> {
  const accessToken = await getConfigApiToken(userId, sessionJwt);
  return { accessToken, roleIds: [], sessionJwt };
}

// ============================================================================
// Read operations
// ============================================================================

export async function listAppsFromStore(accessToken: string): Promise<AppConfigRecord[]> {
  try {
    const entries = await configListApps(accessToken);
    return entries.map(registryToRecord).sort((a, b) => (a.displayOrder - b.displayOrder) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function listAppsForWrite(
  accessToken: string,
  _roleIds: string[],
  _sessionJwt?: string,
): Promise<AppConfigRecord[]> {
  return listAppsFromStore(accessToken);
}

export async function getAppByIdFromStore(accessToken: string, appId: string): Promise<AppConfigRecord | null> {
  const entry = await configGetApp(accessToken, appId);
  return entry ? registryToRecord(entry) : null;
}

export async function getAppByNameFromStore(accessToken: string, appName: string): Promise<AppConfigRecord | null> {
  const apps = await listAppsFromStore(accessToken);
  return apps.find((app) => app.name === appName) || null;
}

export async function getAppsByIdsFromStore(accessToken: string, appIds: string[]): Promise<AppConfigRecord[]> {
  if (!appIds.length) return [];
  const wanted = new Set(appIds);
  const apps = await listAppsFromStore(accessToken);
  return apps.filter((app) => wanted.has(app.id));
}

// ============================================================================
// Write operations
// ============================================================================

export async function createAppInStore(
  accessToken: string,
  _roleIds: string[],
  input: AppConfigCreateInput,
  _sessionJwt?: string,
): Promise<AppConfigRecord> {
  const data = recordToRegistryInput(input as AppConfigRecord);
  const entry = await adminCreateApp(accessToken, data as any);
  return registryToRecord(entry);
}

export async function updateAppInStore(
  accessToken: string,
  _roleIds: string[],
  appId: string,
  updates: AppConfigUpdateInput,
  _sessionJwt?: string,
): Promise<AppConfigRecord | null> {
  const entry = await adminUpdateApp(accessToken, appId, updates as any);
  return entry ? registryToRecord(entry) : null;
}

export async function deleteAppInStore(
  accessToken: string,
  _roleIds: string[],
  appId: string,
  _sessionJwt?: string,
): Promise<boolean> {
  return adminDeleteApp(accessToken, appId);
}

export async function reorderAppsInStore(
  accessToken: string,
  _roleIds: string[],
  updates: Array<{ id: string; displayOrder: number }>,
): Promise<number> {
  return adminReorderApps(accessToken, updates);
}

export async function countAppsInStore(
  accessToken: string,
  predicate?: (app: AppConfigRecord) => boolean,
): Promise<number> {
  const apps = await listAppsFromStore(accessToken);
  if (!predicate) return apps.length;
  return apps.filter(predicate).length;
}

// ============================================================================
// StoreContext-based API (compatibility wrappers)
// ============================================================================

type StoreContext = { userId: string; sessionJwt: string };

export async function getAppConfigById(context: StoreContext, appId: string): Promise<AppConfigRecord | null> {
  const { accessToken } = await getAppConfigStoreContextForUser(context.userId, context.sessionJwt);
  return getAppByIdFromStore(accessToken, appId);
}

export async function getAllAppConfigs(context: StoreContext): Promise<AppConfigRecord[]> {
  const { accessToken } = await getAppConfigStoreContextForUser(context.userId, context.sessionJwt);
  return listAppsFromStore(accessToken);
}

export async function updateAppConfig(
  context: StoreContext,
  appId: string,
  updates: AppConfigUpdateInput,
): Promise<AppConfigRecord | null> {
  const { accessToken } = await getAppConfigStoreContextForUser(context.userId, context.sessionJwt);
  return adminUpdateApp(accessToken, appId, updates as any).then(e => e ? registryToRecord(e) : null);
}

export async function deleteAppConfig(context: StoreContext, appId: string): Promise<void> {
  const { accessToken } = await getAppConfigStoreContextForUser(context.userId, context.sessionJwt);
  await adminDeleteApp(accessToken, appId);
}

export async function findAppConfigByPath(
  context: StoreContext,
  path: string,
  opts: { excludeId?: string; builtInAndLibraryOnly?: boolean } = {},
): Promise<AppConfigRecord | null> {
  const apps = await getAllAppConfigs(context);
  return (
    apps.find((app) => {
      if (opts.excludeId && app.id === opts.excludeId) return false;
      if (opts.builtInAndLibraryOnly && app.type !== 'BUILT_IN' && app.type !== 'LIBRARY') return false;
      return app.url === path || app.deployedPath === path;
    }) || null
  );
}

export async function listAppConfigs(
  context: StoreContext,
  opts: { type?: AppConfigType | null; includeDisabled?: boolean } = {},
): Promise<AppConfigRecord[]> {
  const apps = await getAllAppConfigs(context);
  const typeFilter = opts.type ?? null;
  const includeDisabled = opts.includeDisabled === true;
  return apps.filter((app) => {
    if (typeFilter && app.type !== typeFilter) return false;
    if (includeDisabled) return true;
    if (typeFilter === 'BUILT_IN') return true;
    return app.isActive || app.type === 'BUILT_IN';
  });
}

export async function reorderAppConfigs(
  context: StoreContext,
  orderUpdates: Array<{ id: string; displayOrder: number }>,
): Promise<void> {
  const { accessToken } = await getAppConfigStoreContextForUser(context.userId, context.sessionJwt);
  await adminReorderApps(accessToken, orderUpdates);
}
