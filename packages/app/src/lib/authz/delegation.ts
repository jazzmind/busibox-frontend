/**
 * Delegation Token API for background/scheduled tasks.
 *
 * Delegation tokens allow a user to create long-lived tokens
 * that can be used by background jobs without requiring the
 * user's session JWT at execution time.
 */

import { getAuthzBaseUrl } from './authz-url';

export interface DelegationToken {
  delegationToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  expiresAt: string;
  jti: string;
  name: string;
  scopes: string[];
}

export interface DelegationTokenInfo {
  jti: string;
  name: string;
  scopes: string[];
  expiresAt: string;
  createdAt: string;
  revoked: boolean;
}

/**
 * Create a delegation token for background tasks.
 *
 * @param sessionJwt - The user's session JWT
 * @param name - Human-readable name for the delegation
 * @param scopes - Scopes to delegate (optional, defaults to all user's scopes)
 * @param expiresInSeconds - TTL in seconds (default: 7 days)
 */
export async function createDelegationToken(args: {
  sessionJwt: string;
  name: string;
  scopes?: string[];
  expiresInSeconds?: number;
}): Promise<DelegationToken> {
  const res = await fetch(`${getAuthzBaseUrl()}/oauth/delegation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject_token: args.sessionJwt,
      name: args.name,
      scopes: args.scopes || [],
      expires_in_seconds: args.expiresInSeconds || 604800,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create delegation token (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    delegationToken: data.delegation_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    expiresAt: data.expires_at,
    jti: data.jti,
    name: data.name,
    scopes: data.scopes,
  };
}

/**
 * List active delegation tokens for the authenticated user.
 */
export async function listDelegationTokens(
  sessionJwt: string
): Promise<DelegationTokenInfo[]> {
  const res = await fetch(`${getAuthzBaseUrl()}/oauth/delegations`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sessionJwt}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list delegation tokens (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.delegations.map((d: any) => ({
    jti: d.jti,
    name: d.name,
    scopes: d.scopes,
    expiresAt: d.expires_at,
    createdAt: d.created_at,
    revoked: d.revoked,
  }));
}

/**
 * Revoke a delegation token.
 */
export async function revokeDelegationToken(sessionJwt: string, jti: string): Promise<void> {
  const res = await fetch(`${getAuthzBaseUrl()}/oauth/delegations/${jti}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${sessionJwt}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to revoke delegation token (${res.status}): ${text}`);
  }
}
