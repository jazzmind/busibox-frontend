/**
 * Data Settings Store
 *
 * Manages document processing / ingestion settings via data-api document storage,
 * replacing the Prisma DataSettings model.
 *
 * Pattern follows portal-config-store.ts: single record in a shared data-api document.
 */

import { getDataApiUrl } from '../next/api-url';
import { exchangeWithSubjectToken } from '../authz/next-client';
import { getSharedRoleIdsForConfig } from './portal-config';

const DOCUMENT_NAME = 'busibox-portal-data-settings';
const RECORD_ID = 'active-settings';

// Mirrors the Prisma DataSettings model
export type DataSettingsRecord = {
  id: string;
  llmCleanupEnabled: boolean;
  multiFlowEnabled: boolean;
  maxParallelStrategies: number;
  markerEnabled: boolean;
  colpaliEnabled: boolean;
  entityExtractionEnabled: boolean;
  chunkSizeMin: number;
  chunkSizeMax: number;
  chunkOverlapPct: number;
  timeoutSmall: number;
  timeoutMedium: number;
  timeoutLarge: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DataSettingsUpdate = Partial<Omit<DataSettingsRecord, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>>;

const DEFAULT_SETTINGS: Omit<DataSettingsRecord, 'id' | 'createdAt' | 'updatedAt'> = {
  llmCleanupEnabled: false,
  multiFlowEnabled: false,
  maxParallelStrategies: 3,
  markerEnabled: false,
  colpaliEnabled: true,
  entityExtractionEnabled: false,
  chunkSizeMin: 400,
  chunkSizeMax: 800,
  chunkOverlapPct: 0.12,
  timeoutSmall: 300,
  timeoutMedium: 600,
  timeoutLarge: 1200,
  isActive: true,
};

type DocumentListItem = { id: string; name: string };

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
  // Filter by sourceApp so we get a focused list even when many documents exist.
  // The data-api unique constraint is on (filename, metadata->>'sourceApp'), so
  // our document is guaranteed to appear in this filtered view.
  const list = await dataApiRequest<{ documents: DocumentListItem[] }>(
    token,
    '/data?sourceApp=busibox-portal&limit=100'
  );
  const existing = (list.documents || []).find((d) => d.name === DOCUMENT_NAME);
  return existing?.id || null;
}

async function ensureDocument(token: string, roleIds: string[]): Promise<string> {
  const existingId = await findDocumentId(token);
  if (existingId) return existingId;

  // Create as a shared admin document. role_ids are optional — if none are
  // resolved the data-api will still create the document accessible to admins.
  const body: Record<string, unknown> = {
    name: DOCUMENT_NAME,
    visibility: 'shared',
    sourceApp: 'busibox-portal',
    enableCache: false,
    schema: {
      displayName: 'Data Processing Settings',
      itemLabel: 'Setting',
      sourceApp: 'busibox-portal',
      visibility: 'shared',
      allowSharing: true,
    },
  };
  if (roleIds.length) {
    body.role_ids = roleIds;
    body.roleIds = roleIds;
  }

  try {
    const created = await dataApiRequest<{ id: string }>(token, '/data', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return created.id;
  } catch (err) {
    // If creation failed due to a duplicate key (another request beat us),
    // find the document that was already created and return its id.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('duplicate') || msg.includes('409')) {
      const retryId = await findDocumentId(token);
      if (retryId) return retryId;
    }
    throw err;
  }
}

async function getSettingsRecord(
  token: string,
  documentId: string
): Promise<Record<string, unknown> | null> {
  const result = await dataApiRequest<{ records?: Array<Record<string, unknown>> }>(
    token,
    `/data/${documentId}/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        where: { field: 'id', op: 'eq', value: RECORD_ID },
        limit: 1,
      }),
    }
  );
  return result.records?.[0] || null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeRecord(raw: Record<string, unknown> | null): DataSettingsRecord {
  const now = new Date().toISOString();
  if (!raw) {
    return {
      id: RECORD_ID,
      ...DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
    };
  }
  return {
    id: RECORD_ID,
    llmCleanupEnabled: asBoolean(raw.llmCleanupEnabled, DEFAULT_SETTINGS.llmCleanupEnabled),
    multiFlowEnabled: asBoolean(raw.multiFlowEnabled, DEFAULT_SETTINGS.multiFlowEnabled),
    maxParallelStrategies: asNumber(raw.maxParallelStrategies, DEFAULT_SETTINGS.maxParallelStrategies),
    markerEnabled: asBoolean(raw.markerEnabled, DEFAULT_SETTINGS.markerEnabled),
    colpaliEnabled: asBoolean(raw.colpaliEnabled, DEFAULT_SETTINGS.colpaliEnabled),
    entityExtractionEnabled: asBoolean(raw.entityExtractionEnabled, DEFAULT_SETTINGS.entityExtractionEnabled),
    chunkSizeMin: asNumber(raw.chunkSizeMin, DEFAULT_SETTINGS.chunkSizeMin),
    chunkSizeMax: asNumber(raw.chunkSizeMax, DEFAULT_SETTINGS.chunkSizeMax),
    chunkOverlapPct: asNumber(raw.chunkOverlapPct, DEFAULT_SETTINGS.chunkOverlapPct),
    timeoutSmall: asNumber(raw.timeoutSmall, DEFAULT_SETTINGS.timeoutSmall),
    timeoutMedium: asNumber(raw.timeoutMedium, DEFAULT_SETTINGS.timeoutMedium),
    timeoutLarge: asNumber(raw.timeoutLarge, DEFAULT_SETTINGS.timeoutLarge),
    isActive: asBoolean(raw.isActive, true),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDataApiTokenForSettings(
  userId: string,
  sessionJwt: string
): Promise<{ accessToken: string; roleIds: string[] }> {
  const tokenResult = await exchangeWithSubjectToken({
    userId,
    sessionJwt,
    audience: 'data-api',
    purpose: 'busibox-portal-data-settings',
  });
  const roleIds = getSharedRoleIdsForConfig(tokenResult.accessToken, sessionJwt);
  return { accessToken: tokenResult.accessToken, roleIds };
}

/**
 * Get active data processing settings. Returns defaults if no settings exist yet.
 */
export async function getDataSettings(
  accessToken: string
): Promise<DataSettingsRecord> {
  const documentId = await findDocumentId(accessToken);
  if (!documentId) {
    return normalizeRecord(null);
  }
  const raw = await getSettingsRecord(accessToken, documentId);
  return normalizeRecord(raw);
}

/**
 * Update data processing settings (upsert). Creates the document and record on first call.
 */
export async function updateDataSettings(
  accessToken: string,
  roleIds: string[],
  updates: DataSettingsUpdate
): Promise<DataSettingsRecord> {
  const documentId = await ensureDocument(accessToken, roleIds);
  const existing = await getSettingsRecord(accessToken, documentId);
  const current = normalizeRecord(existing);
  const now = new Date().toISOString();

  const next: DataSettingsRecord = {
    ...current,
    ...updates,
    id: RECORD_ID,
    isActive: true,
    updatedAt: now,
  };

  if (existing) {
    await dataApiRequest<{ count: number }>(accessToken, `/data/${documentId}/records`, {
      method: 'PUT',
      body: JSON.stringify({
        updates: next,
        where: { field: 'id', op: 'eq', value: RECORD_ID },
        validate: false,
      }),
    });
  } else {
    await dataApiRequest<{ count: number }>(accessToken, `/data/${documentId}/records`, {
      method: 'POST',
      body: JSON.stringify({
        records: [{ ...next, createdAt: now }],
        validate: false,
      }),
    });
  }

  return next;
}

/**
 * Get default settings without needing a token (for fallback/display).
 */
export function getDefaultDataSettings(): DataSettingsRecord {
  const now = new Date().toISOString();
  return {
    id: RECORD_ID,
    ...DEFAULT_SETTINGS,
    createdAt: now,
    updatedAt: now,
  };
}
