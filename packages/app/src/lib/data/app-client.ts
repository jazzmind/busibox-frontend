/**
 * Data Service Client (busibox-portal wrapper)
 * 
 * This file re-exports from busibox-app for backward compatibility.
 * New code should import directly from '@jazzmind/busibox-app'.
 * 
 * @deprecated Import from '@jazzmind/busibox-app' instead
 */

import {
  dataFetch as busiboxDataFetch,
  uploadChatAttachment as busiboxUploadChatAttachment,
  parseFileToMarkdown as busiboxParseFileToMarkdown,
  dataChatAttachment as busiboxDataChatAttachment,
  getChatAttachmentUrl as busiboxGetChatAttachmentUrl,
  deleteChatAttachment as busiboxDeleteChatAttachment,
  getDataServiceUrl as busiboxGetDataServiceUrl,
  type DataServiceError as BusiboxDataServiceError,
  type DataClientOptions as BusiboxDataClientOptions,
} from '@jazzmind/busibox-app';
import { exchangeWithSubjectToken, invalidateDownstreamToken } from '../authz/next-client';

// Re-export types
export type DataServiceError = BusiboxDataServiceError;

/**
 * Track the last token we acquired, so we know if we need to invalidate cache on retry
 */
let lastTokenByUser = new Map<string, { token: string; timestamp: number }>();

// Store session JWTs for Zero Trust token exchange
// This is set by the caller (e.g., middleware or API route)
let sessionJwtStore = new Map<string, string>();

/**
 * Set the session JWT for a user (called by middleware/API routes before data operations)
 */
export function setSessionJwtForUser(userId: string, sessionJwt: string): void {
  sessionJwtStore.set(userId, sessionJwt);
}

/**
 * Clear the session JWT for a user
 */
export function clearSessionJwtForUser(userId: string): void {
  sessionJwtStore.delete(userId);
}

/**
 * Server-side token acquisition for busibox-portal (Zero Trust)
 *
 * Note: The data service requires specific scopes for different operations:
 * - data.write: required for uploads
 * - data.read: required for fetching files
 * - data.delete: required for deleting files
 *
 * Since busibox-app passes empty scopes by default, we request all data scopes
 * to ensure the token works for any operation.
 */
async function getAuthzToken(userId: string, audience: string, scopes: string[]): Promise<string> {
  // Get session JWT from store (must be set by caller)
  const sessionJwt = sessionJwtStore.get(userId);
  if (!sessionJwt) {
    throw new Error(
      `No session JWT available for user ${userId}. Call setSessionJwtForUser() before data operations.`
    );
  }

  // Request all data scopes since busibox-app doesn't know which operation is being performed
  const dataScopes = scopes.length > 0 ? scopes : ['data.read', 'data.write', 'data.delete'];

  // Note: we no longer auto-invalidate tokens on rapid requests.
  // The original heuristic ("request within 1 second = must be a 401 retry")
  // was wrong for parallel requests (e.g., 100+ image loads). The caller
  // should explicitly invalidate via invalidateDownstreamToken on actual 401.

  // Use Zero Trust token exchange (no client credentials)
  const result = await exchangeWithSubjectToken({
    sessionJwt,
    userId,
    audience: audience as any,
    scopes: dataScopes,
    purpose: 'busibox-portal.data',
  });

  // Track this token for potential invalidation on retry
  lastTokenByUser.set(userId, { token: result.accessToken, timestamp: Date.now() });

  return result.accessToken;
}

/**
 * Upload a file for chat attachment (backward compatible)
 * 
 * @deprecated Use busibox-app's uploadChatAttachment with tokenManager
 */
export async function uploadChatAttachment(
  file: File,
  userId: string
): Promise<{
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}> {
  return busiboxUploadChatAttachment(file, { userId, getAuthzToken });
}

/**
 * Parse file to markdown (backward compatible)
 * 
 * @deprecated Use busibox-app's parseFileToMarkdown with tokenManager
 */
export async function parseFileToMarkdown(
  fileId: string,
  userId: string
): Promise<{
  markdown: string;
  metadata: {
    pageCount?: number;
    wordCount?: number;
    language?: string;
  };
}> {
  return busiboxParseFileToMarkdown(fileId, { userId, getAuthzToken });
}

/**
 * Data file with full processing (backward compatible)
 * 
 * @deprecated Use busibox-app's dataChatAttachment with tokenManager
 */
export async function dataChatAttachment(
  fileId: string,
  userId: string,
  options: {
    collection?: string;
    chunkSize?: number;
    chunkOverlap?: number;
  } = {}
): Promise<{
  jobId: string;
  status: string;
  documentId: string;
}> {
  return busiboxDataChatAttachment(fileId, { userId, getAuthzToken }, options);
}

/**
 * Get file download URL (backward compatible)
 * 
 * @deprecated Use busibox-app's getChatAttachmentUrl with tokenManager
 */
export async function getChatAttachmentUrl(
  fileId: string,
  userId: string,
  expirySeconds: number = 3600
): Promise<string> {
  return busiboxGetChatAttachmentUrl(fileId, { userId, getAuthzToken }, expirySeconds);
}

/**
 * Delete chat attachment file (backward compatible)
 * 
 * @deprecated Use busibox-app's deleteChatAttachment with tokenManager
 */
export async function deleteChatAttachment(
  fileId: string,
  userId: string
): Promise<void> {
  return busiboxDeleteChatAttachment(fileId, { userId, getAuthzToken });
}

/**
 * Get the data service base URL
 */
export function getDataServiceUrl(): string {
  return busiboxGetDataServiceUrl();
}

/**
 * Get the data service port
 */
export function getDataServicePort(): string {
  const url = getDataServiceUrl();
  const match = url.match(/:(\d+)$/);
  return match ? match[1] : '8002';
}

/**
 * Fetch from data service (backward compatible)
 * 
 * @deprecated Use busibox-app's dataFetch with tokenManager
 */
export async function dataFetch(
  context: string,
  path: string,
  options?: RequestInit & { userId?: string; timeout?: number }
): Promise<Response> {
  const { userId, timeout, ...fetchOptions } = options || {};
  
  if (!userId) {
    throw new Error('userId is required for data operations');
  }

  return busiboxDataFetch(context, path, {
    ...fetchOptions,
    userId,
    getAuthzToken,
    timeout,
  });
}
