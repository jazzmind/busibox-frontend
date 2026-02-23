/**
 * Chat Configuration Store (data-api backed)
 *
 * Stores chat configuration (e.g., streaming_enabled) in the same
 * data-api document used by portal-config-store (`busibox-portal-config`),
 * as a separate record with id `chat-config`.
 *
 * For reads that don't have a user session (e.g., internal message route),
 * we use X-Internal-Service header with DATA_API_INTERNAL_KEY.
 */

import { getDataApiUrl } from '../next/api-url';
import { exchangeWithSubjectToken } from '../authz/next-client';

const DOCUMENT_NAME = 'busibox-portal-config';
const RECORD_ID = 'chat-config';

export type ChatConfigRecord = {
  streaming_enabled: boolean;
};

const DEFAULT_CHAT_CONFIG: ChatConfigRecord = {
  streaming_enabled: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

type DocumentListItem = { id: string; name: string };

async function findConfigDocumentId(token: string): Promise<string | null> {
  const list = await dataApiRequest<{ documents: DocumentListItem[] }>(token, '/data');
  const existing = (list.documents || []).find((d) => d.name === DOCUMENT_NAME);
  return existing?.id || null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Exchange a session JWT for a data-api access token scoped to chat config.
 */
export async function getChatConfigToken(
  userId: string,
  sessionJwt: string
): Promise<string> {
  const result = await exchangeWithSubjectToken({
    userId,
    sessionJwt,
    audience: 'data-api',
    purpose: 'chat-config',
  });
  return result.accessToken;
}

/**
 * Read the current chat config from data-api.
 * Returns defaults if the record doesn't exist yet.
 */
export async function getChatConfig(token: string): Promise<ChatConfigRecord> {
  try {
    const documentId = await findConfigDocumentId(token);
    if (!documentId) return { ...DEFAULT_CHAT_CONFIG };

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

    const record = result.records?.[0];
    if (!record) return { ...DEFAULT_CHAT_CONFIG };

    return {
      streaming_enabled:
        typeof record.streaming_enabled === 'boolean'
          ? record.streaming_enabled
          : DEFAULT_CHAT_CONFIG.streaming_enabled,
    };
  } catch (error) {
    console.error('[chat-config-store] Failed to read config:', error);
    return { ...DEFAULT_CHAT_CONFIG };
  }
}

/**
 * Upsert (create or update) chat config in data-api.
 */
export async function upsertChatConfig(
  token: string,
  updates: Partial<ChatConfigRecord>,
  roleIds: string[]
): Promise<ChatConfigRecord> {
  // Ensure the busibox-portal-config document exists
  let documentId = await findConfigDocumentId(token);
  if (!documentId) {
    if (!roleIds.length) {
      throw new Error('Cannot create config document without role IDs');
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
    documentId = created.id;
  }

  // Read existing
  const existing = await getChatConfig(token);
  const merged: ChatConfigRecord = { ...existing, ...updates };
  const now = new Date().toISOString();

  // Check if record exists
  const queryResult = await dataApiRequest<{ records?: Array<Record<string, unknown>> }>(
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

  if (queryResult.records?.length) {
    await dataApiRequest(token, `/data/${documentId}/records`, {
      method: 'PUT',
      body: JSON.stringify({
        updates: { ...merged, updatedAt: now },
        where: { field: 'id', op: 'eq', value: RECORD_ID },
        validate: false,
      }),
    });
  } else {
    await dataApiRequest(token, `/data/${documentId}/records`, {
      method: 'POST',
      body: JSON.stringify({
        records: [{ id: RECORD_ID, ...merged, createdAt: now, updatedAt: now }],
        validate: false,
      }),
    });
  }

  return merged;
}

export function getDefaultChatConfig(): ChatConfigRecord {
  return { ...DEFAULT_CHAT_CONFIG };
}
