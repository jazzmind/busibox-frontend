/**
 * Session-aware embeddings convenience wrappers.
 *
 * These store session JWTs per-user so that call sites can
 * simply pass `(text, userId)` without threading the JWT through
 * every call. Use `setSessionJwtForUser` early in the request,
 * then call `generateEmbeddingForUser` / `generateEmbeddingsForUser`.
 */

import { exchangeTokenZeroTrust } from '../authz/zero-trust';
import {
  generateEmbedding as coreGenerateEmbedding,
  generateEmbeddings as coreGenerateEmbeddings,
  isEmbeddingsConfigured as coreIsConfigured,
  getEmbeddingDimension as coreGetDimension,
} from './embeddings';

const sessionJwtStore = new Map<string, string>();

export function setEmbeddingSessionJwt(userId: string, sessionJwt: string): void {
  sessionJwtStore.set(userId, sessionJwt);
}

export function clearEmbeddingSessionJwt(userId: string): void {
  sessionJwtStore.delete(userId);
}

async function getAuthzToken(userId: string, audience: string, scopes: string[]): Promise<string> {
  const sessionJwt = sessionJwtStore.get(userId);
  if (!sessionJwt) {
    throw new Error(
      `No session JWT available for user ${userId}. Call setEmbeddingSessionJwt() before embeddings operations.`
    );
  }

  const result = await exchangeTokenZeroTrust(
    {
      sessionJwt,
      audience: audience as any,
      scopes,
      purpose: 'busibox.embeddings',
    },
    {
      authzBaseUrl: process.env.AUTHZ_BASE_URL || 'http://authz-api:8010',
      verbose: process.env.VERBOSE_AUTHZ_LOGGING === 'true',
    }
  );
  return result.accessToken;
}

/**
 * Generate embeddings for multiple texts, using the stored session JWT for auth.
 */
export async function generateEmbeddingsForUser(texts: string[], userId: string): Promise<number[][]> {
  return coreGenerateEmbeddings(texts, { userId, getAuthzToken });
}

/**
 * Generate a single embedding, using the stored session JWT for auth.
 */
export async function generateEmbeddingForUser(text: string, userId: string): Promise<number[]> {
  return coreGenerateEmbedding(text, { userId, getAuthzToken });
}

export { coreIsConfigured as isEmbeddingsConfigured, coreGetDimension as getEmbeddingDimension };
