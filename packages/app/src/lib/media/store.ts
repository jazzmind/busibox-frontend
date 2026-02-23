/**
 * Video Store
 *
 * Manages Video, VideoShare, and VideoReferenceMedia via data-api document storage,
 * replacing the Prisma Video, VideoShare, and VideoReferenceMedia models.
 *
 * Pattern follows data-settings-store.ts and app-config-store.ts:
 * - Shared visibility with role_ids
 * - Document-per-entity-type
 */

import { getDataApiUrl } from '../next/api-url';
import { exchangeWithSubjectToken } from '../authz/next-client';
import { getSharedRoleIdsForConfig } from '../data/portal-config';
import type { VideoStatus, VideoVisibility } from '../../types/video';

const DOCUMENT_VIDEOS = 'busibox-portal-videos';
const DOCUMENT_VIDEO_SHARES = 'busibox-portal-video-shares';
const DOCUMENT_VIDEO_REFERENCE_MEDIA = 'busibox-portal-video-reference-media';

type DocumentListItem = { id: string; name: string };

type DataApiQueryResponse = {
  records?: Array<Record<string, unknown>>;
  total?: number;
};

type DataApiOperationResponse = {
  count: number;
  recordIds?: string[];
};

// ---------------------------------------------------------------------------
// Types (mirror Prisma models)
// ---------------------------------------------------------------------------

export type VideoRecord = {
  id: string;
  ownerId: string;
  openaiVideoId: string | null;
  prompt: string;
  durationSeconds: number;
  resolution: string;
  status: VideoStatus;
  visibility: VideoVisibility;
  createdAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  openaiModel: string | null;
  downloadUrl: string | null;
  posterUrl: string | null;
  progress: number | null;
  errorMessage: string | null;
};

export type VideoShareRecord = {
  id: string;
  videoId: string;
  userId: string;
  sharedBy: string;
  sharedAt: Date;
};

export type VideoReferenceMediaRecord = {
  id: string;
  videoId: string;
  fileType: string;
  format: string;
  fileSizeBytes: number;
  base64Data: string;
  uploadedAt: Date;
};

export type VideoCreateInput = Omit<VideoRecord, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: Date | string;
};

export type VideoUpdateInput = Partial<
  Omit<VideoRecord, 'id' | 'ownerId' | 'createdAt'>
>;

export type VideoShareCreateInput = {
  videoId: string;
  userId: string;
  sharedBy: string;
};

export type VideoReferenceMediaCreateInput = Omit<
  VideoReferenceMediaRecord,
  'id' | 'uploadedAt'
> & {
  id?: string;
  uploadedAt?: Date | string;
};

export type VideoListFilters = {
  filter?: 'my-videos' | 'public' | 'shared';
  userId?: string;
  status?: VideoStatus;
  limit?: number;
  offset?: number;
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

async function findDocumentId(
  token: string,
  documentName: string
): Promise<string | null> {
  const list = await dataApiRequest<{ documents: DocumentListItem[] }>(
    token,
    '/data'
  );
  const existing = (list.documents || []).find((d) => d.name === documentName);
  return existing?.id || null;
}

async function ensureDocument(
  token: string,
  documentName: string,
  roleIds: string[],
  schema: { displayName: string; itemLabel: string }
): Promise<string> {
  const existingId = await findDocumentId(token, documentName);
  if (existingId) return existingId;
  if (!roleIds.length) {
    throw new Error(
      `Cannot create shared ${documentName} document without role IDs`
    );
  }

  const created = await dataApiRequest<{ id: string }>(token, '/data', {
    method: 'POST',
    body: JSON.stringify({
      name: documentName,
      visibility: 'shared',
      role_ids: roleIds,
      roleIds: roleIds,
      sourceApp: 'busibox-portal',
      enableCache: false,
      schema: {
        ...schema,
        sourceApp: 'busibox-portal',
        visibility: 'shared',
        allowSharing: true,
      },
    }),
  });

  return created.id;
}

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

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeVideo(raw: Record<string, unknown>): VideoRecord {
  const now = new Date();
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    ownerId: typeof raw.ownerId === 'string' ? raw.ownerId : '',
    openaiVideoId: asStringOrNull(raw.openaiVideoId),
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    durationSeconds: asNumber(raw.durationSeconds, 4),
    resolution: typeof raw.resolution === 'string' ? raw.resolution : '1280x720',
    status: (raw.status as VideoStatus) || ('QUEUED' as VideoStatus),
    visibility:
      (raw.visibility as VideoVisibility) || ('PRIVATE' as VideoVisibility),
    createdAt: asDate(raw.createdAt, now),
    completedAt: asNullableDate(raw.completedAt),
    expiresAt: asNullableDate(raw.expiresAt),
    openaiModel: asStringOrNull(raw.openaiModel),
    downloadUrl: asStringOrNull(raw.downloadUrl),
    posterUrl: asStringOrNull(raw.posterUrl),
    progress: raw.progress != null ? asNumber(raw.progress, 0) : null,
    errorMessage: asStringOrNull(raw.errorMessage),
  };
}

function normalizeVideoShare(raw: Record<string, unknown>): VideoShareRecord {
  const now = new Date();
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    videoId: typeof raw.videoId === 'string' ? raw.videoId : '',
    userId: typeof raw.userId === 'string' ? raw.userId : '',
    sharedBy: typeof raw.sharedBy === 'string' ? raw.sharedBy : '',
    sharedAt: asDate(raw.sharedAt, now),
  };
}

function normalizeVideoReferenceMedia(
  raw: Record<string, unknown>
): VideoReferenceMediaRecord {
  const now = new Date();
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    videoId: typeof raw.videoId === 'string' ? raw.videoId : '',
    fileType: typeof raw.fileType === 'string' ? raw.fileType : '',
    format: typeof raw.format === 'string' ? raw.format : '',
    fileSizeBytes: asNumber(raw.fileSizeBytes, 0),
    base64Data: typeof raw.base64Data === 'string' ? raw.base64Data : '',
    uploadedAt: asDate(raw.uploadedAt, now),
  };
}

// ---------------------------------------------------------------------------
// Public API - Context
// ---------------------------------------------------------------------------

export async function getVideoStoreContext(
  userId: string,
  sessionJwt: string
): Promise<{ accessToken: string; roleIds: string[] }> {
  const tokenResult = await exchangeWithSubjectToken({
    userId,
    sessionJwt,
    audience: 'data-api',
    purpose: 'busibox-portal-videos',
  });
  const roleIds = getSharedRoleIdsForConfig(tokenResult.accessToken, sessionJwt);
  return { accessToken: tokenResult.accessToken, roleIds };
}

// ---------------------------------------------------------------------------
// Public API - Videos
// ---------------------------------------------------------------------------

export async function listVideos(
  accessToken: string,
  filters: VideoListFilters = {}
): Promise<{ videos: VideoRecord[]; total: number }> {
  const {
    filter = 'my-videos',
    userId = '',
    status,
    limit = 20,
    offset = 0,
  } = filters;

  const vidDocId = await findDocumentId(accessToken, DOCUMENT_VIDEOS);
  if (!vidDocId) {
    return { videos: [], total: 0 };
  }

  // Query all videos (data-api may not support complex filters; we filter in memory)
  const result = await dataApiRequest<DataApiQueryResponse>(
    accessToken,
    `/data/${vidDocId}/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        limit: 1000, // data-api max is 1000
        offset: 0,
      }),
    }
  );

  let records = (result.records || []).map((r) => normalizeVideo(r));

  // Apply filter
  if (filter === 'my-videos' && userId) {
    records = records.filter((r) => r.ownerId === userId);
  } else if (filter === 'public') {
    records = records.filter((r) => r.visibility === 'PUBLIC');
  } else if (filter === 'shared' && userId) {
    const sharesDocId = await findDocumentId(accessToken, DOCUMENT_VIDEO_SHARES);
    if (!sharesDocId) {
      return { videos: [], total: 0 };
    }
    const sharesResult = await dataApiRequest<DataApiQueryResponse>(
      accessToken,
      `/data/${sharesDocId}/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          where: { field: 'userId', op: 'eq', value: userId },
          limit: 1000,
        }),
      }
    );
    const sharedVideoIds = new Set(
      (sharesResult.records || []).map((r) => String(r.videoId))
    );
    records = records.filter(
      (r) => r.visibility === 'SHARED' && sharedVideoIds.has(r.id)
    );
  }

  if (status) {
    records = records.filter((r) => r.status === status);
  }

  const total = records.length;
  const videos = records
    .sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
    )
    .slice(offset, offset + limit);

  return { videos, total };
}

export async function findVideoByFileId(
  accessToken: string,
  fileId: string
): Promise<VideoRecord | null> {
  const docId = await findDocumentId(accessToken, DOCUMENT_VIDEOS);
  if (!docId) return null;

  const result = await dataApiRequest<DataApiQueryResponse>(
    accessToken,
    `/data/${docId}/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        limit: 1000,
        offset: 0,
      }),
    }
  );

  const videos = (result.records || []).map((r) => normalizeVideo(r));
  const match = videos.find(
    (v) =>
      (v.downloadUrl && v.downloadUrl.includes(fileId)) ||
      (v.posterUrl && v.posterUrl.includes(fileId))
  );
  return match || null;
}

export async function getVideoById(
  accessToken: string,
  videoId: string
): Promise<VideoRecord | null> {
  const docId = await findDocumentId(accessToken, DOCUMENT_VIDEOS);
  if (!docId) return null;

  const result = await dataApiRequest<DataApiQueryResponse>(
    accessToken,
    `/data/${docId}/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        where: { field: 'id', op: 'eq', value: videoId },
        limit: 1,
      }),
    }
  );

  const raw = result.records?.[0];
  return raw ? normalizeVideo(raw) : null;
}

export async function createVideo(
  accessToken: string,
  roleIds: string[],
  input: VideoCreateInput
): Promise<VideoRecord> {
  const docId = await ensureDocument(
    accessToken,
    DOCUMENT_VIDEOS,
    roleIds,
    { displayName: 'Videos', itemLabel: 'Video' }
  );

  const id = input.id || crypto.randomUUID();
  const now = new Date();
  const record: VideoRecord = {
    ...input,
    id,
    createdAt: input.createdAt ? asDate(input.createdAt, now) : now,
    completedAt: input.completedAt ? asDate(input.completedAt, now) : null,
    expiresAt: input.expiresAt ? asDate(input.expiresAt, now) : null,
    openaiVideoId: input.openaiVideoId ?? null,
    downloadUrl: input.downloadUrl ?? null,
    posterUrl: input.posterUrl ?? null,
    progress: input.progress ?? null,
    errorMessage: input.errorMessage ?? null,
    openaiModel: input.openaiModel ?? null,
  };

  const toStore = {
    ...record,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
  };

  await dataApiRequest<DataApiOperationResponse>(
    accessToken,
    `/data/${docId}/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        records: [toStore],
        validate: false,
      }),
    }
  );

  return record;
}

export async function updateVideo(
  accessToken: string,
  roleIds: string[],
  videoId: string,
  updates: VideoUpdateInput
): Promise<VideoRecord | null> {
  const docId = await ensureDocument(
    accessToken,
    DOCUMENT_VIDEOS,
    roleIds,
    { displayName: 'Videos', itemLabel: 'Video' }
  );

  const existing = await getVideoById(accessToken, videoId);
  if (!existing) return null;

  const merged: VideoRecord = {
    ...existing,
    ...updates,
    id: videoId,
  };

  const toStore = {
    ...merged,
    createdAt: merged.createdAt.toISOString(),
    completedAt: merged.completedAt?.toISOString() ?? null,
    expiresAt: merged.expiresAt?.toISOString() ?? null,
  };

  await dataApiRequest<DataApiOperationResponse>(
    accessToken,
    `/data/${docId}/records`,
    {
      method: 'PUT',
      body: JSON.stringify({
        updates: toStore,
        where: { field: 'id', op: 'eq', value: videoId },
        validate: false,
      }),
    }
  );

  return merged;
}

export async function deleteVideo(
  accessToken: string,
  roleIds: string[],
  videoId: string
): Promise<boolean> {
  const docId = await findDocumentId(accessToken, DOCUMENT_VIDEOS);
  if (!docId) return false;

  // Delete shares for this video
  const sharesDocId = await findDocumentId(accessToken, DOCUMENT_VIDEO_SHARES);
  if (sharesDocId) {
    const sharesResult = await dataApiRequest<DataApiQueryResponse>(
      accessToken,
      `/data/${sharesDocId}/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          where: { field: 'videoId', op: 'eq', value: videoId },
          limit: 1000,
        }),
      }
    );
    const shareIds = (sharesResult.records || []).map((r) => String(r.id));
    if (shareIds.length > 0) {
      await dataApiRequest<DataApiOperationResponse>(
        accessToken,
        `/data/${sharesDocId}/records`,
        {
          method: 'DELETE',
          body: JSON.stringify({ recordIds: shareIds }),
        }
      );
    }
  }

  // Delete reference media for this video
  const mediaDocId = await findDocumentId(
    accessToken,
    DOCUMENT_VIDEO_REFERENCE_MEDIA
  );
  if (mediaDocId) {
    const mediaResult = await dataApiRequest<DataApiQueryResponse>(
      accessToken,
      `/data/${mediaDocId}/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          where: { field: 'videoId', op: 'eq', value: videoId },
          limit: 1,
        }),
      }
    );
    const mediaIds = (mediaResult.records || []).map((r) => String(r.id));
    if (mediaIds.length > 0) {
      await dataApiRequest<DataApiOperationResponse>(
        accessToken,
        `/data/${mediaDocId}/records`,
        {
          method: 'DELETE',
          body: JSON.stringify({ recordIds: mediaIds }),
        }
      );
    }
  }

  const result = await dataApiRequest<DataApiOperationResponse>(
    accessToken,
    `/data/${docId}/records`,
    {
      method: 'DELETE',
      body: JSON.stringify({ recordIds: [videoId] }),
    }
  );

  return result.count > 0;
}

// ---------------------------------------------------------------------------
// Public API - Video Shares
// ---------------------------------------------------------------------------

export async function listVideoShares(
  accessToken: string,
  videoId: string
): Promise<VideoShareRecord[]> {
  const docId = await findDocumentId(accessToken, DOCUMENT_VIDEO_SHARES);
  if (!docId) return [];

  const result = await dataApiRequest<DataApiQueryResponse>(
    accessToken,
    `/data/${docId}/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        where: { field: 'videoId', op: 'eq', value: videoId },
        limit: 500,
      }),
    }
  );

  return (result.records || []).map(normalizeVideoShare);
}

export async function createVideoShare(
  accessToken: string,
  roleIds: string[],
  videoId: string,
  shareData: { userId: string; sharedBy: string }
): Promise<VideoShareRecord> {
  const docId = await ensureDocument(
    accessToken,
    DOCUMENT_VIDEO_SHARES,
    roleIds,
    { displayName: 'Video Shares', itemLabel: 'Share' }
  );

  const id = crypto.randomUUID();
  const now = new Date();
  const record: VideoShareRecord = {
    id,
    videoId,
    userId: shareData.userId,
    sharedBy: shareData.sharedBy,
    sharedAt: now,
  };

  await dataApiRequest<DataApiOperationResponse>(
    accessToken,
    `/data/${docId}/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        records: [{ ...record, sharedAt: record.sharedAt.toISOString() }],
        validate: false,
      }),
    }
  );

  return record;
}

export async function deleteVideoShare(
  accessToken: string,
  roleIds: string[],
  shareId: string
): Promise<boolean> {
  const docId = await findDocumentId(accessToken, DOCUMENT_VIDEO_SHARES);
  if (!docId) return false;

  const result = await dataApiRequest<DataApiOperationResponse>(
    accessToken,
    `/data/${docId}/records`,
    {
      method: 'DELETE',
      body: JSON.stringify({ recordIds: [shareId] }),
    }
  );

  return result.count > 0;
}

export async function deleteVideoShareByVideoAndUser(
  accessToken: string,
  roleIds: string[],
  videoId: string,
  userId: string
): Promise<boolean> {
  const docId = await findDocumentId(accessToken, DOCUMENT_VIDEO_SHARES);
  if (!docId) return false;

  const result = await dataApiRequest<DataApiQueryResponse>(
    accessToken,
    `/data/${docId}/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        where: { field: 'videoId', op: 'eq', value: videoId },
        limit: 100,
      }),
    }
  );

  const matchingShares = (result.records || []).filter(
    (r) => String(r.userId) === userId
  );
  const shareIds = matchingShares.map((r) => String(r.id));
  if (shareIds.length === 0) return false;

  await dataApiRequest<DataApiOperationResponse>(
    accessToken,
    `/data/${docId}/records`,
    {
      method: 'DELETE',
      body: JSON.stringify({ recordIds: shareIds }),
    }
  );

  return true;
}

// ---------------------------------------------------------------------------
// Public API - Video Reference Media
// ---------------------------------------------------------------------------

export async function listVideoReferenceMedia(
  accessToken: string,
  videoId: string
): Promise<VideoReferenceMediaRecord[]> {
  const docId = await findDocumentId(
    accessToken,
    DOCUMENT_VIDEO_REFERENCE_MEDIA
  );
  if (!docId) return [];

  const result = await dataApiRequest<DataApiQueryResponse>(
    accessToken,
    `/data/${docId}/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        where: { field: 'videoId', op: 'eq', value: videoId },
        limit: 10,
      }),
    }
  );

  return (result.records || []).map(normalizeVideoReferenceMedia);
}

export async function getVideoReferenceMedia(
  accessToken: string,
  videoId: string
): Promise<VideoReferenceMediaRecord | null> {
  const list = await listVideoReferenceMedia(accessToken, videoId);
  return list[0] || null;
}

export async function createVideoReferenceMedia(
  accessToken: string,
  roleIds: string[],
  input: VideoReferenceMediaCreateInput
): Promise<VideoReferenceMediaRecord> {
  const docId = await ensureDocument(
    accessToken,
    DOCUMENT_VIDEO_REFERENCE_MEDIA,
    roleIds,
    { displayName: 'Video Reference Media', itemLabel: 'Reference Media' }
  );

  const id = input.id || crypto.randomUUID();
  const now = new Date();
  const record: VideoReferenceMediaRecord = {
    ...input,
    id,
    uploadedAt: input.uploadedAt ? asDate(input.uploadedAt, now) : now,
  };

  await dataApiRequest<DataApiOperationResponse>(
    accessToken,
    `/data/${docId}/records`,
    {
      method: 'POST',
      body: JSON.stringify({
        records: [{ ...record, uploadedAt: record.uploadedAt.toISOString() }],
        validate: false,
      }),
    }
  );

  return record;
}

export async function deleteVideoReferenceMedia(
  accessToken: string,
  roleIds: string[],
  mediaId: string
): Promise<boolean> {
  const docId = await findDocumentId(
    accessToken,
    DOCUMENT_VIDEO_REFERENCE_MEDIA
  );
  if (!docId) return false;

  const result = await dataApiRequest<DataApiOperationResponse>(
    accessToken,
    `/data/${docId}/records`,
    {
      method: 'DELETE',
      body: JSON.stringify({ recordIds: [mediaId] }),
    }
  );

  return result.count > 0;
}
