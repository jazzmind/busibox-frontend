import { exchangeWithSubjectToken } from '../authz/next-client';
import { getDataApiUrl } from '../next/api-url';

const DOCUMENT_NAME = 'busibox-portal-config';
const RECORD_ID = 'portal-customization';

export type PortalConfig = {
  companyName: string;
  siteName: string;
  slogan: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  addressLine1: string;
  addressLine2: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  customCss: string | null;
  setupComplete: boolean;
  setupCompletedAt: string | null;
  setupCompletedBy: string | null;
};

const DEFAULT_CONFIG: PortalConfig = {
  companyName: 'Busibox Portal',
  siteName: 'Busibox Portal',
  slogan: 'How about a nice game of chess?',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#000000',
  secondaryColor: '#8B0000',
  textColor: '#FFFFFF',
  addressLine1: 'Cheyenne Mountain',
  addressLine2: null,
  addressCity: null,
  addressState: 'NV',
  addressZip: null,
  addressCountry: 'USA',
  supportEmail: null,
  supportPhone: null,
  customCss: null,
  setupComplete: false,
  setupCompletedAt: null,
  setupCompletedBy: null,
};

type DataApiToken = { accessToken: string };

type DocumentListItem = { id: string; name: string };

async function dataApiRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
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

function normalizeConfigRecord(record: Record<string, unknown> | null): PortalConfig {
  if (!record) return { ...DEFAULT_CONFIG };
  return {
    ...DEFAULT_CONFIG,
    ...record,
    setupComplete: record.setupComplete === true,
    setupCompletedAt: (record.setupCompletedAt as string | null) ?? null,
    setupCompletedBy: (record.setupCompletedBy as string | null) ?? null,
  };
}

async function findConfigDocumentId(token: string): Promise<string | null> {
  const list = await dataApiRequest<{ documents: DocumentListItem[] }>(token, '/data');
  const existing = (list.documents || []).find((d) => d.name === DOCUMENT_NAME);
  return existing?.id || null;
}

async function ensureConfigDocument(token: string, roleIds: string[]): Promise<string> {
  const existingId = await findConfigDocumentId(token);
  if (existingId) return existingId;
  if (!roleIds.length) {
    throw new Error('Cannot create shared config document without role IDs');
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
        displayName: 'Portal Configuration',
        itemLabel: 'Setting',
        sourceApp: 'busibox-portal',
        visibility: 'shared',
        allowSharing: true,
      },
    }),
  });
  return created.id;
}

async function getConfigRecord(token: string, documentId: string): Promise<Record<string, unknown> | null> {
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

export async function getDataApiTokenForUser(userId: string, sessionJwt: string): Promise<DataApiToken> {
  const tokenResult = await exchangeWithSubjectToken({
    userId,
    sessionJwt,
    audience: 'data-api',
    purpose: 'busibox-portal-config',
  });
  return { accessToken: tokenResult.accessToken };
}

export async function getPortalConfigFromDataApi(token: string): Promise<PortalConfig> {
  const documentId = await findConfigDocumentId(token);
  if (!documentId) {
    return { ...DEFAULT_CONFIG };
  }
  const record = await getConfigRecord(token, documentId);
  return normalizeConfigRecord(record);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeRoleIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeRoleObjectIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (!v || typeof v !== 'object') return '';
      const id = (v as { id?: unknown }).id;
      return typeof id === 'string' ? id.trim() : '';
    })
    .filter(Boolean);
}

function extractRoleIdsFromClaims(claims: Record<string, unknown> | null): string[] {
  if (!claims) return [];
  return [
    // Prefer explicit create-role IDs when present
    ...normalizeRoleIdArray(claims.user_role_ids_create),
    ...normalizeRoleIdArray(claims['app.user_role_ids_create']),
    ...normalizeRoleIdArray(claims.role_ids_create),
    // Common generic role ID claims
    ...normalizeRoleIdArray(claims.role_ids),
    ...normalizeRoleIdArray(claims.user_role_ids),
    // Session JWT in busibox-portal embeds role objects: [{id,name}, ...]
    ...normalizeRoleObjectIds(claims.roles),
    // Read-role IDs as fallback
    ...normalizeRoleIdArray(claims.user_role_ids_read),
    ...normalizeRoleIdArray(claims['app.user_role_ids_read']),
  ];
}

export function getSharedRoleIdsForConfig(
  dataApiAccessToken: string,
  sessionJwt?: string
): string[] {
  const dataApiClaims = decodeJwtPayload(dataApiAccessToken);
  const sessionClaims = sessionJwt ? decodeJwtPayload(sessionJwt) : null;

  const roleIds = Array.from(new Set([
    ...extractRoleIdsFromClaims(dataApiClaims),
    ...extractRoleIdsFromClaims(sessionClaims),
  ]));

  if (!roleIds.length) {
    throw new Error('No role IDs available in token claims for shared config visibility');
  }
  return roleIds;
}

export async function upsertPortalConfigInDataApi(
  token: string,
  updates: Partial<PortalConfig>,
  roleIds: string[]
): Promise<PortalConfig> {
  const documentId = await ensureConfigDocument(token, roleIds);
  const existing = await getConfigRecord(token, documentId);
  const merged = normalizeConfigRecord(existing);
  const now = new Date().toISOString();

  const next: PortalConfig = {
    ...merged,
    ...updates,
    setupComplete: updates.setupComplete ?? merged.setupComplete,
    setupCompletedAt: updates.setupCompletedAt ?? merged.setupCompletedAt,
    setupCompletedBy: updates.setupCompletedBy ?? merged.setupCompletedBy,
  };

  if (existing) {
    await dataApiRequest<{ count: number }>(token, `/data/${documentId}/records`, {
      method: 'PUT',
      body: JSON.stringify({
        updates: {
          ...next,
          updatedAt: now,
        },
        where: { field: 'id', op: 'eq', value: RECORD_ID },
        validate: false,
      }),
    });
  } else {
    await dataApiRequest<{ count: number }>(token, `/data/${documentId}/records`, {
      method: 'POST',
      body: JSON.stringify({
        records: [
          {
            id: RECORD_ID,
            ...next,
            createdAt: now,
            updatedAt: now,
          },
        ],
        validate: false,
      }),
    });
  }

  return next;
}

export function getDefaultPortalConfig(): PortalConfig {
  return { ...DEFAULT_CONFIG };
}

/**
 * Sync the portal site name to deploy-api config store so backend services
 * (e.g. agent-api) can read it for notification subjects without needing
 * a data-api token.
 */
export async function syncSiteNameToDeployApi(
  userId: string,
  sessionJwt: string,
  siteName: string,
): Promise<void> {
  try {
    const { getDeployApiToken, setConfig } = await import('../deploy/client');
    const deployToken = await getDeployApiToken(userId, sessionJwt);
    await setConfig(deployToken, 'PORTAL_SITE_NAME', {
      value: siteName,
      category: 'portal',
      description: 'Portal display name (synced from branding settings)',
    });
  } catch (error) {
    console.warn('[PORTAL-CONFIG] Failed to sync site name to deploy-api:', error);
  }
}
