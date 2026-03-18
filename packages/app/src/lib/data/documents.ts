/**
 * Generic Data Documents Client for Busibox data-api.
 *
 * Provides document management and CRUD operations for structured data documents.
 * Use with token from requireAuthWithTokenExchange(request, 'data-api').
 *
 * @example
 * ```typescript
 * const auth = await requireAuthWithTokenExchange(request, 'data-api');
 * if (auth instanceof NextResponse) return auth;
 * const docs = await ensureDocuments(auth.apiToken, { projects: { name: 'my-projects', schema, visibility: 'personal' } });
 * const { records } = await queryRecords<Project>(auth.apiToken, docs.projects, { limit: 10 });
 * ```
 */

import { dataFetch, getDataServiceUrl } from './client';
import type {
  DocumentInfo,
  DataDocument,
  DataDocumentConfig,
  QueryOptions,
  QueryFilter,
  QueryCondition,
} from '../../types/data-documents';

export type { DocumentInfo, DataDocument, QueryOptions, QueryFilter, QueryCondition };

export interface DataDocumentsOptions {
  /** Override data API URL (default: DATA_API_URL or http://localhost:8002) */
  dataUrl?: string;
  /** Filter documents by sourceApp when listing (for ensureDocuments) */
  sourceApp?: string;
  /** Max documents to fetch when listing */
  limit?: number;
}

export interface DocumentRoleAssignment {
  role_id: string;
  role_name: string;
  added_at?: string;
  added_by?: string | null;
}

export interface DocumentRolesResponse {
  documentId: string;
  visibility: 'personal' | 'shared';
  roleIds: string[];
  roles: DocumentRoleAssignment[];
}

async function dataDocumentsRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
  options?: DataDocumentsOptions
): Promise<T> {
  const baseUrl = options?.dataUrl || getDataServiceUrl();
  const url = `${baseUrl}${path}`;
  const response = await dataFetch(`Data documents ${path}`, path, {
    accessToken: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
    dataUrl: options?.dataUrl,
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    },
  });
  return response.json();
}

// ==========================================================================
// Utilities
// ==========================================================================

export function generateId(): string {
  return crypto.randomUUID();
}

export function getNow(): string {
  return new Date().toISOString();
}

/**
 * Strip undefined values from an object to prevent JSON serialization issues.
 */
export function cleanRecord<T>(record: T): T {
  if (!record || typeof record !== 'object') return record;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}

/**
 * Extract role IDs from a JWT token (without verification).
 * Used for shared visibility documents.
 */
export function extractRoleIdsFromToken(token: string): string[] {
  try {
    const parts = token.replace(/^Bearer\s+/i, '').split('.');
    if (parts.length !== 3) return [];
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof Buffer !== 'undefined'
        ? Buffer.from(b64, 'base64').toString('utf-8')
        : typeof atob !== 'undefined'
          ? atob(b64)
          : '';
    const payload = JSON.parse(json);
    const roles = payload.roles || [];
    return roles
      .map((r: string | { id?: string }) => (typeof r === 'string' ? r : r?.id))
      .filter((id: string | undefined): id is string => !!id);
  } catch {
    return [];
  }
}

// ==========================================================================
// Document Management
// ==========================================================================

export async function listDataDocuments(
  token: string,
  options?: DataDocumentsOptions
): Promise<DocumentInfo[]> {
  const params = new URLSearchParams();
  if (options?.sourceApp) params.set('sourceApp', options.sourceApp);
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString() ? `?${params}` : '';
  const response = await dataDocumentsRequest<{ documents: DocumentInfo[]; total?: number }>(
    token,
    `/data${query}`,
    {},
    options
  );
  return response.documents || [];
}

export async function createDataDocument(
  token: string,
  name: string,
  schema: Record<string, unknown>,
  visibility: 'personal' | 'shared' = 'shared',
  options?: DataDocumentsOptions
): Promise<DataDocument> {
  const sourceApp = schema.sourceApp as string | undefined;
  const roleIds =
    visibility === 'shared' ? extractRoleIdsFromToken(token) : undefined;
  const effectiveVisibility =
    visibility === 'shared' && roleIds && roleIds.length > 0 ? 'shared' : 'personal';

  return dataDocumentsRequest<DataDocument>(
    token,
    '/data',
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        schema,
        visibility: effectiveVisibility,
        roleIds: effectiveVisibility === 'shared' ? roleIds : undefined,
        enableCache: false,
        sourceApp,
      }),
    },
    options
  );
}

export async function getDocumentByName(
  token: string,
  name: string,
  options?: DataDocumentsOptions
): Promise<DataDocument | null> {
  const documents = await listDataDocuments(token, options);
  const doc = documents.find((d) => d.name === name);
  if (!doc) return null;
  return dataDocumentsRequest<DataDocument>(
    token,
    `/data/${doc.id}`,
    {},
    options
  );
}

export async function getDocumentDetails(
  token: string,
  documentId: string,
  options?: DataDocumentsOptions
): Promise<DataDocument & { sourceApp?: string; metadata?: Record<string, unknown> }> {
  return dataDocumentsRequest<DataDocument & { sourceApp?: string; metadata?: Record<string, unknown> }>(
    token,
    `/data/${documentId}?includeRecords=false`,
    {},
    options
  );
}

export async function updateDocumentMetadata(
  token: string,
  documentId: string,
  metadata: Record<string, unknown>,
  schema?: Record<string, unknown>,
  options?: DataDocumentsOptions
): Promise<void> {
  await dataDocumentsRequest<unknown>(
    token,
    `/data/${documentId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ metadata, schema }),
    },
    options
  );
}

export async function getDocumentRoles(
  token: string,
  documentId: string,
  options?: DataDocumentsOptions
): Promise<DocumentRolesResponse> {
  return dataDocumentsRequest<DocumentRolesResponse>(
    token,
    `/data/${documentId}/roles`,
    {},
    options
  );
}

export async function updateDocumentRoles(
  token: string,
  documentId: string,
  roleIds: string[],
  visibility?: 'personal' | 'shared',
  options?: DataDocumentsOptions
): Promise<DocumentRolesResponse> {
  return dataDocumentsRequest<DocumentRolesResponse>(
    token,
    `/data/${documentId}/roles`,
    {
      method: 'PUT',
      body: JSON.stringify({ roleIds, visibility }),
    },
    options
  );
}

export async function ensureSchemaAndMetadata(
  token: string,
  documentId: string,
  schema: Record<string, unknown>,
  sourceApp: string,
  options?: DataDocumentsOptions
): Promise<void> {
  try {
    const doc = await getDocumentDetails(token, documentId, options);
    const existingSchema = doc.schema as Record<string, unknown> | undefined;
    const needsSourceApp = !doc.sourceApp;

    const existingRelationNames = Object.keys(
      (existingSchema?.relations as Record<string, unknown>) || {}
    );
    const newRelationNames = Object.keys(
      (schema.relations as Record<string, unknown>) || {}
    );
    const relationsChanged =
      (existingRelationNames.length === 0 && newRelationNames.length > 0) ||
      existingRelationNames.length !== newRelationNames.length ||
      !newRelationNames.every((name) => existingRelationNames.includes(name));

    const existingGraphNode = existingSchema?.graphNode as string | undefined;
    const newGraphNode = schema.graphNode as string | undefined;
    const existingGraphRels = (existingSchema?.graphRelationships as unknown[]) || [];
    const newGraphRels = (schema.graphRelationships as unknown[]) || [];
    const graphChanged =
      existingGraphNode !== newGraphNode ||
      existingGraphRels.length !== newGraphRels.length;

    const fieldsChanged = haveFieldsChanged(existingSchema, schema);

    const needsSchemaUpdate = relationsChanged || graphChanged || fieldsChanged;

    if (needsSourceApp || needsSchemaUpdate) {
      const existingMetadata = (doc.metadata || {}) as Record<string, unknown>;
      const mergedMetadata = { ...existingMetadata, sourceApp };
      await updateDocumentMetadata(
        token,
        documentId,
        mergedMetadata,
        schema,
        options
      );
    }
  } catch (error) {
    console.warn(
      `[data-documents] Failed to ensure schema for document ${documentId}:`,
      error
    );
  }
}

/**
 * Compare field definitions between existing and new schemas.
 * Detects new fields, removed fields, type changes, and enum values changes.
 */
function haveFieldsChanged(
  existingSchema: Record<string, unknown> | undefined,
  newSchema: Record<string, unknown>
): boolean {
  const existingFields = (existingSchema?.fields || {}) as Record<string, Record<string, unknown>>;
  const newFields = (newSchema.fields || {}) as Record<string, Record<string, unknown>>;

  const existingKeys = Object.keys(existingFields);
  const newKeys = Object.keys(newFields);

  if (existingKeys.length !== newKeys.length) return true;
  if (!newKeys.every((k) => existingKeys.includes(k))) return true;

  for (const key of newKeys) {
    const oldField = existingFields[key];
    const newField = newFields[key];
    if (!oldField) return true;

    if (oldField.type !== newField.type) return true;

    const oldEnum = (oldField.values as string[]) || [];
    const newEnum = (newField.values as string[]) || [];
    if (oldEnum.length !== newEnum.length) return true;
    if (!newEnum.every((v, i) => oldEnum[i] === v)) return true;
  }

  return false;
}

// ==========================================================================
// Generic Record Operations
// ==========================================================================

export async function queryRecords<T>(
  token: string,
  documentId: string,
  queryOptions: QueryOptions = {},
  options?: DataDocumentsOptions
): Promise<{ records: T[]; total: number }> {
  return dataDocumentsRequest<{ records: T[]; total: number }>(
    token,
    `/data/${documentId}/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        select: queryOptions.select,
        where: queryOptions.where,
        orderBy: queryOptions.orderBy,
        limit: queryOptions.limit || 100,
        offset: queryOptions.offset || 0,
      }),
    },
    options
  );
}

export async function insertRecords<T>(
  token: string,
  documentId: string,
  records: T[],
  validate = true,
  options?: DataDocumentsOptions
): Promise<{ count: number; recordIds: string[] }> {
  return dataDocumentsRequest<{ count: number; recordIds: string[] }>(
    token,
    `/data/${documentId}/records`,
    {
      method: 'POST',
      body: JSON.stringify({ records, validate }),
    },
    options
  );
}

export async function updateRecords(
  token: string,
  documentId: string,
  updates: Record<string, unknown>,
  where?: QueryFilter | QueryCondition,
  validate = true,
  options?: DataDocumentsOptions
): Promise<{ count: number }> {
  return dataDocumentsRequest<{ count: number }>(
    token,
    `/data/${documentId}/records`,
    {
      method: 'PUT',
      body: JSON.stringify({ updates, where, validate }),
    },
    options
  );
}

export async function deleteRecords(
  token: string,
  documentId: string,
  where?: QueryFilter | QueryCondition,
  recordIds?: string[],
  options?: DataDocumentsOptions
): Promise<{ count: number }> {
  return dataDocumentsRequest<{ count: number }>(
    token,
    `/data/${documentId}/records`,
    {
      method: 'DELETE',
      body: JSON.stringify({ where, recordIds }),
    },
    options
  );
}

// ==========================================================================
// ensureDocuments - Generic document setup helper
// ==========================================================================

/**
 * Ensure all configured documents exist. Creates missing ones and updates schemas.
 *
 * @param token - Bearer token from requireAuthWithTokenExchange
 * @param config - Map of key -> { name, schema, visibility }
 * @param sourceApp - App identifier for schema metadata
 * @returns Map of key -> document ID
 */
export async function ensureDocuments<T extends Record<string, DataDocumentConfig>>(
  token: string,
  config: T,
  sourceApp: string,
  options?: DataDocumentsOptions
): Promise<{ [K in keyof T]: string }> {
  const documents = await listDataDocuments(token, { ...options, limit: 100 });
  const result: Record<string, string> = {} as { [K in keyof T]: string };

  for (const [key, docConfig] of Object.entries(config)) {
    const existing = documents.find((d) => d.name === docConfig.name);
    const schema = { ...docConfig.schema, sourceApp };

    if (!existing) {
      const created = await createDataDocument(
        token,
        docConfig.name,
        schema,
        docConfig.visibility || 'shared',
        options
      );
      result[key] = created.id;
    } else {
      result[key] = existing.id;
      await ensureSchemaAndMetadata(
        token,
        existing.id,
        schema,
        sourceApp,
        options
      );
    }
  }

  return result as { [K in keyof T]: string };
}
