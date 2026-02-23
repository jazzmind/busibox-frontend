/**
 * Agent API Client (busibox-portal wrapper)
 *
 * Provides session JWT storage and Zero Trust token exchange for agent operations.
 * Use with agentApiFetch from './agent-api-base' for authenticated agent calls.
 */

import { getAgentApiUrl } from './agent-api-base';
import { exchangeWithSubjectToken } from '../authz/next-client';

// Store session JWTs for Zero Trust token exchange
let sessionJwtStore = new Map<string, string>();

/**
 * Set the session JWT for a user (called by middleware/API routes before agent operations)
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
 * Server-side token acquisition for busibox-portal (Zero Trust).
 * Use with agentApiFetch from './agent-api-base' for authenticated agent calls.
 */
export async function getAuthzToken(userId: string, audience: string, scopes: string[]): Promise<string> {
  // Get session JWT from store (must be set by caller)
  const sessionJwt = sessionJwtStore.get(userId);
  if (!sessionJwt) {
    throw new Error(
      `No session JWT available for user ${userId}. Call setSessionJwtForUser() before agent operations.`
    );
  }

  // Use Zero Trust token exchange (no client credentials)
  const result = await exchangeWithSubjectToken({
    sessionJwt,
    userId,
    audience: audience as any,
    scopes,
    purpose: 'busibox-portal.agent',
  });
  return result.accessToken;
}

/**
 * Get the agent service base URL
 */
export function getAgentServiceUrl(): string {
  return getAgentApiUrl();
}
