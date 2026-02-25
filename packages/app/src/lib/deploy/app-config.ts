import { getDataApiUrl } from '../next/api-url';
import { exchangeWithSubjectToken, getAuthzOptionsWithToken } from '../authz/next-client';
import { getSeededApps, getSeededAppIds } from './default-apps';
import { getSharedRoleIdsForConfig } from '../data/portal-config';
import { getRoleByName, listRoleBindings, grantRoleResourceAccess } from '@jazzmind/busibox-app';

const DOCUMENT_NAME = 'busibox-portal-app-config';

type DocumentListItem = { id: string; name: string };

type DataApiOperationResponse = {
  count: number;
  recordIds?: string[];
};

type DataApiQueryResponse = {
  records?: Array<Record<string, unknown>>;
};

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

const DEFAULT_APP_TEMPLATE: Omit<AppConfigRecord, 'id' | 'name' | 'type' | 'createdAt' | 'updatedAt'> = {
  ssoAudience: null,
  description: null,
  url: null,
  deployedPath: null,
  iconUrl: null,
  selectedIcon: null,
  displayOrder: 0,
  isActive: true,
  healthEndpoint: null,
  oauthClientSecret: null,
  githubToken: null,
  githubRepo: null,
  lastDeploymentId: null,
  lastDeploymentStatus: null,
  lastDeploymentLogs: null,
  lastDeploymentStartedAt: null,
  lastDeploymentEndedAt: null,
  lastDeploymentError: null,
  deployedVersion: null,
  latestVersion: null,
  latestVersionCheckedAt: null,
  updateAvailable: false,
  devMode: false,
  primaryColor: null,
  secondaryColor: null,
};

function asDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return fallback;
}

function asNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = asDate(value, new Date(0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value === 'string') return value;
  return null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeType(value: unknown): AppConfigType {
  if (value === 'BUILT_IN' || value === 'LIBRARY' || value === 'EXTERNAL' || value === 'INTERNAL') return value;
  return 'EXTERNAL';
}

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

function toStoreRecord(raw: Record<string, unknown>): AppConfigRecord {
  const now = new Date();
  const record: AppConfigRecord = {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    name: typeof raw.name === 'string' ? raw.name : 'Unnamed App',
    type: normalizeType(raw.type),
    createdAt: asDate(raw.createdAt, now),
    updatedAt: asDate(raw.updatedAt, now),
    ...DEFAULT_APP_TEMPLATE,
    ssoAudience: asStringOrNull(raw.ssoAudience),
    description: asStringOrNull(raw.description),
    url: asStringOrNull(raw.url),
    deployedPath: asStringOrNull(raw.deployedPath),
    iconUrl: asStringOrNull(raw.iconUrl),
    selectedIcon: asStringOrNull(raw.selectedIcon),
    displayOrder: asNumber(raw.displayOrder, 0),
    isActive: asBoolean(raw.isActive, true),
    healthEndpoint: asStringOrNull(raw.healthEndpoint),
    oauthClientSecret: asStringOrNull(raw.oauthClientSecret),
    githubToken: asStringOrNull(raw.githubToken),
    githubRepo: asStringOrNull(raw.githubRepo),
    lastDeploymentId: asStringOrNull(raw.lastDeploymentId),
    lastDeploymentStatus: asStringOrNull(raw.lastDeploymentStatus),
    lastDeploymentLogs: asStringOrNull(raw.lastDeploymentLogs),
    lastDeploymentStartedAt: asNullableDate(raw.lastDeploymentStartedAt),
    lastDeploymentEndedAt: asNullableDate(raw.lastDeploymentEndedAt),
    lastDeploymentError: asStringOrNull(raw.lastDeploymentError),
    deployedVersion: asStringOrNull(raw.deployedVersion),
    latestVersion: asStringOrNull(raw.latestVersion),
    latestVersionCheckedAt: asNullableDate(raw.latestVersionCheckedAt),
    updateAvailable: asBoolean(raw.updateAvailable, false),
    devMode: asBoolean(raw.devMode, false),
    primaryColor: asStringOrNull(raw.primaryColor),
    secondaryColor: asStringOrNull(raw.secondaryColor),
  };
  record.ssoAudience = resolveStableSsoAudience(record);
  return record;
}

function fromSeededDefaults(): AppConfigRecord[] {
  return getSeededApps().map((app) =>
    toStoreRecord({
      ...app,
      oauthClientSecret: null,
      githubToken: null,
      lastDeploymentId: null,
      lastDeploymentStartedAt: null,
      lastDeploymentError: null,
      lastDeploymentLogs: null,
      lastDeploymentStatus: app.lastDeploymentStatus,
      lastDeploymentEndedAt: app.lastDeploymentEndedAt,
    })
  );
}

function serializeRecordForDataApi(record: AppConfigRecord): Record<string, unknown> {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastDeploymentStartedAt: record.lastDeploymentStartedAt?.toISOString() ?? null,
    lastDeploymentEndedAt: record.lastDeploymentEndedAt?.toISOString() ?? null,
    latestVersionCheckedAt: record.latestVersionCheckedAt?.toISOString() ?? null,
  };
}

async function dataApiRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getDataApiUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`data-api ${response.status} ${path}: ${text}`);
  }

  return (await response.json()) as T;
}

async function findDocumentId(token: string): Promise<string | null> {
  const list = await dataApiRequest<{ documents: DocumentListItem[] }>(token, '/data');
  const existing = (list.documents || []).find((doc) => doc.name === DOCUMENT_NAME);
  return existing?.id || null;
}

async function ensureDocument(token: string, roleIds: string[]): Promise<string> {
  const existingId = await findDocumentId(token);
  if (existingId) return existingId;
  if (!roleIds.length) {
    throw new Error('Cannot create shared app-config document without role IDs');
  }

  const created = await dataApiRequest<{ id: string }>(token, '/data', {
    method: 'POST',
    body: JSON.stringify({
      name: DOCUMENT_NAME,
      visibility: 'shared',
      role_ids: roleIds,
      roleIds: roleIds,
      sourceApp: 'busibox-portal',
      enableCache: false,
      schema: {
        displayName: 'App Configuration',
        itemLabel: 'Application',
        sourceApp: 'busibox-portal',
        visibility: 'shared',
        allowSharing: true,
      },
    }),
  });

  return created.id;
}

async function queryAllAppRecords(token: string, documentId: string): Promise<AppConfigRecord[]> {
  const result = await dataApiRequest<DataApiQueryResponse>(token, `/data/${documentId}/query`, {
    method: 'POST',
    body: JSON.stringify({
      limit: 1000,
      offset: 0,
    }),
  });

  return (result.records || []).map(toStoreRecord);
}

async function ensureSeededRecords(token: string, documentId: string): Promise<boolean> {
  const records = await queryAllAppRecords(token, documentId);
  const seededDefaults = fromSeededDefaults();

  if (records.length === 0) {
    const seeded = seededDefaults.map(serializeRecordForDataApi);
    await dataApiRequest<DataApiOperationResponse>(token, `/data/${documentId}/records`, {
      method: 'POST',
      body: JSON.stringify({
        records: seeded,
        validate: false,
      }),
    });
    return true;
  }

  const existingById = new Map(records.map((record) => [record.id, record]));
  let changed = false;

  for (const seeded of seededDefaults) {
    const existing = existingById.get(seeded.id);
    if (!existing) {
      await dataApiRequest<DataApiOperationResponse>(token, `/data/${documentId}/records`, {
        method: 'POST',
        body: JSON.stringify({
          records: [serializeRecordForDataApi(seeded)],
          validate: false,
        }),
      });
      changed = true;
      continue;
    }

    // Keep seeded defaults authoritative for seeded app identity/visibility fields.
    const needsSeedSync =
      existing.name !== seeded.name ||
      existing.type !== seeded.type ||
      existing.url !== seeded.url ||
      existing.healthEndpoint !== seeded.healthEndpoint ||
      existing.isActive !== seeded.isActive ||
      existing.selectedIcon !== seeded.selectedIcon ||
      existing.description !== seeded.description;

    if (!needsSeedSync) continue;

    const merged = toStoreRecord({
      ...existing,
      ...seeded,
      id: existing.id,
      displayOrder: existing.displayOrder,
      createdAt: existing.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await dataApiRequest<DataApiOperationResponse>(token, `/data/${documentId}/records`, {
      method: 'PUT',
      body: JSON.stringify({
        updates: serializeRecordForDataApi(merged),
        where: { field: 'id', op: 'eq', value: existing.id },
        validate: false,
      }),
    });
    changed = true;
  }

  return changed;
}

/**
 * Idempotently grant Admin role access to all seeded apps.
 * Fails gracefully if authz is not ready (e.g. during initial bootstrap).
 */
async function ensureAdminBindingsForSeededApps(sessionJwt: string): Promise<void> {
  try {
    const options = await getAuthzOptionsWithToken(sessionJwt);
    const adminRole = await getRoleByName('Admin', options);
    if (!adminRole) {
      console.warn('[app-config-store] Admin role not found in authz — skipping seed bindings');
      return;
    }

    const seededIds = getSeededAppIds();
    for (const appId of seededIds) {
      try {
        const existing = await listRoleBindings(
          { role_id: adminRole.id, resource_type: 'app', resource_id: appId },
          options
        );
        if (existing.length > 0) continue;

        await grantRoleResourceAccess(adminRole.id, 'app', appId, undefined, options);
        console.log(`[app-config-store] Granted Admin access to seeded app: ${appId}`);
      } catch (bindingError) {
        console.warn(`[app-config-store] Failed to grant Admin access to ${appId}:`, bindingError);
      }
    }
  } catch (error) {
    console.warn('[app-config-store] Could not create admin bindings for seeded apps (authz may not be ready):', error);
  }
}

async function ensureDocumentAndSeed(token: string, roleIds: string[], sessionJwt?: string): Promise<string> {
  const documentId = await ensureDocument(token, roleIds);
  const didSeed = await ensureSeededRecords(token, documentId);
  if (sessionJwt) {
    // Fire-and-forget: keep Admin bindings aligned for all seeded apps.
    ensureAdminBindingsForSeededApps(sessionJwt).catch((err) =>
      console.warn('[app-config-store] Background admin binding failed:', err)
    );
  }
  return documentId;
}

export async function getAppConfigStoreContextForUser(userId: string, sessionJwt: string): Promise<AppConfigStoreContext & { sessionJwt: string }> {
  const tokenResult = await exchangeWithSubjectToken({
    userId,
    sessionJwt,
    audience: 'data-api',
    purpose: 'busibox-portal-app-config',
  });

  const roleIds = getSharedRoleIdsForConfig(tokenResult.accessToken, sessionJwt);
  return { accessToken: tokenResult.accessToken, roleIds, sessionJwt };
}

export async function listAppsFromStore(accessToken: string): Promise<AppConfigRecord[]> {
  const documentId = await findDocumentId(accessToken);
  if (!documentId) {
    return fromSeededDefaults();
  }

  const records = await queryAllAppRecords(accessToken, documentId);
  if (!records.length) {
    return fromSeededDefaults();
  }
  return records.sort((a, b) => (a.displayOrder - b.displayOrder) || a.name.localeCompare(b.name));
}

export async function listAppsForWrite(accessToken: string, roleIds: string[], sessionJwt?: string): Promise<AppConfigRecord[]> {
  const documentId = await ensureDocumentAndSeed(accessToken, roleIds, sessionJwt);
  const records = await queryAllAppRecords(accessToken, documentId);
  return records.sort((a, b) => (a.displayOrder - b.displayOrder) || a.name.localeCompare(b.name));
}

export async function getAppByIdFromStore(accessToken: string, appId: string): Promise<AppConfigRecord | null> {
  const apps = await listAppsFromStore(accessToken);
  return apps.find((app) => app.id === appId) || null;
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

export async function createAppInStore(
  accessToken: string,
  roleIds: string[],
  input: AppConfigCreateInput,
  sessionJwt?: string
): Promise<AppConfigRecord> {
  const documentId = await ensureDocumentAndSeed(accessToken, roleIds, sessionJwt);
  const now = new Date();

  const nextRecord = toStoreRecord({
    ...DEFAULT_APP_TEMPLATE,
    ...input,
    id: input.id,
    name: input.name,
    type: input.type,
    createdAt: (input.createdAt || now).toISOString(),
    updatedAt: (input.updatedAt || now).toISOString(),
  });

  await dataApiRequest<DataApiOperationResponse>(accessToken, `/data/${documentId}/records`, {
    method: 'POST',
    body: JSON.stringify({
      records: [serializeRecordForDataApi(nextRecord)],
      validate: false,
    }),
  });

  return nextRecord;
}

export async function updateAppInStore(
  accessToken: string,
  roleIds: string[],
  appId: string,
  updates: AppConfigUpdateInput,
  sessionJwt?: string
): Promise<AppConfigRecord | null> {
  const documentId = await ensureDocumentAndSeed(accessToken, roleIds, sessionJwt);
  const existing = await getAppByIdFromStore(accessToken, appId);
  if (!existing) return null;

  const merged = toStoreRecord({
    ...existing,
    ...updates,
    id: existing.id,
    updatedAt: (updates.updatedAt || new Date()).toISOString(),
  });

  await dataApiRequest<DataApiOperationResponse>(accessToken, `/data/${documentId}/records`, {
    method: 'PUT',
    body: JSON.stringify({
      updates: serializeRecordForDataApi(merged),
      where: { field: 'id', op: 'eq', value: appId },
      validate: false,
    }),
  });

  return merged;
}

export async function deleteAppInStore(accessToken: string, roleIds: string[], appId: string, sessionJwt?: string): Promise<boolean> {
  const documentId = await ensureDocumentAndSeed(accessToken, roleIds, sessionJwt);
  const result = await dataApiRequest<DataApiOperationResponse>(accessToken, `/data/${documentId}/records`, {
    method: 'DELETE',
    body: JSON.stringify({
      recordIds: [appId],
    }),
  });

  return result.count > 0;
}

export async function reorderAppsInStore(
  accessToken: string,
  roleIds: string[],
  updates: Array<{ id: string; displayOrder: number }>
): Promise<number> {
  const documentId = await ensureDocumentAndSeed(accessToken, roleIds);
  const apps = await queryAllAppRecords(accessToken, documentId);
  const appById = new Map(apps.map((a) => [a.id, a]));

  let applied = 0;

  for (const item of updates) {
    const existing = appById.get(item.id);
    if (!existing || existing.displayOrder === item.displayOrder) continue;

    const merged = toStoreRecord({
      ...existing,
      displayOrder: item.displayOrder,
      updatedAt: new Date().toISOString(),
    });

    await dataApiRequest<DataApiOperationResponse>(accessToken, `/data/${documentId}/records`, {
      method: 'PUT',
      body: JSON.stringify({
        updates: serializeRecordForDataApi(merged),
        where: { field: 'id', op: 'eq', value: item.id },
        validate: false,
      }),
    });
    applied += 1;
  }

  return applied;
}

export async function countAppsInStore(
  accessToken: string,
  predicate?: (app: AppConfigRecord) => boolean
): Promise<number> {
  const apps = await listAppsFromStore(accessToken);
  if (!predicate) return apps.length;
  return apps.filter(predicate).length;
}

// Compatibility wrappers for StoreContext-based API ({ userId, sessionJwt })
type StoreContext = { userId: string; sessionJwt: string };

export async function getAppConfigById(
  context: StoreContext,
  appId: string
): Promise<AppConfigRecord | null> {
  const { accessToken } = await getAppConfigStoreContextForUser(context.userId, context.sessionJwt);
  return getAppByIdFromStore(accessToken, appId);
}

export async function getAllAppConfigs(context: StoreContext): Promise<AppConfigRecord[]> {
  const { accessToken, roleIds, sessionJwt } = await getAppConfigStoreContextForUser(context.userId, context.sessionJwt);
  return listAppsForWrite(accessToken, roleIds, sessionJwt);
}

export async function updateAppConfig(
  context: StoreContext,
  appId: string,
  updates: AppConfigUpdateInput
): Promise<AppConfigRecord | null> {
  const { accessToken, roleIds, sessionJwt } = await getAppConfigStoreContextForUser(context.userId, context.sessionJwt);
  return updateAppInStore(accessToken, roleIds, appId, updates, sessionJwt);
}

export async function deleteAppConfig(context: StoreContext, appId: string): Promise<void> {
  const { accessToken, roleIds, sessionJwt } = await getAppConfigStoreContextForUser(context.userId, context.sessionJwt);
  await deleteAppInStore(accessToken, roleIds, appId, sessionJwt);
}

export async function findAppConfigByPath(
  context: StoreContext,
  path: string,
  opts: { excludeId?: string; builtInAndLibraryOnly?: boolean } = {}
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
  opts: { type?: AppConfigType | null; includeDisabled?: boolean } = {}
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
  orderUpdates: Array<{ id: string; displayOrder: number }>
): Promise<void> {
  const { accessToken, roleIds } = await getAppConfigStoreContextForUser(context.userId, context.sessionJwt);
  await reorderAppsInStore(accessToken, roleIds, orderUpdates);
}
