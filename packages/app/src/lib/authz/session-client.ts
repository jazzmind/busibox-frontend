/**
 * Auth Client for busibox-app
 * 
 * Zero Trust Authentication Architecture:
 * All authentication is handled by the authz service. There are NO admin tokens
 * or client credentials - everything uses JWTs (session or access tokens).
 * 
 * Authentication Methods:
 * - User operations: Use session JWT (exchanged for access token)
 * - Login flows: Authz endpoints are public (they ARE the authentication)
 * - Service operations: Use service account JWT
 * 
 * Usage:
 * ```typescript
 * import { validateSession, useMagicLink } from '@jazzmind/busibox-app';
 * 
 * // Validate a session token (returns session with user info)
 * const session = await validateSession('session-jwt', {
 *   authzUrl: process.env.AUTHZ_BASE_URL,
 * });
 * 
 * // Use magic link for passwordless login (no auth needed - this IS auth)
 * const result = await useMagicLink(magicLink.token, { authzUrl });
 * ```
 */

const DEFAULT_AUTHZ_URL = process.env.AUTHZ_BASE_URL || process.env.AUTHZ_URL || 'http://authz-api:8010';

export interface AuthClientOptions {
  /**
   * Override authz service URL.
   * Defaults to AUTHZ_BASE_URL or AUTHZ_URL environment variable.
   */
  authzUrl?: string;
  
  /**
   * Access token (JWT) for authenticated operations.
   * For user operations, this is obtained via token exchange with session JWT.
   * For service operations, this is the service account's access token.
   */
  accessToken?: string;
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  session_id: string;
  user_id: string;
  token: string;
  /** JWT for Zero Trust token exchange (signed by authz) */
  session_jwt?: string;
  expires_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  user?: {
    user_id: string;
    email: string;
    status: string;
  };
}

export interface CreateSessionParams {
  userId: string;
  token: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// Magic Link Types
// ============================================================================

export interface MagicLink {
  magic_link_id: string;
  token: string;
  email: string;
  expires_at: string;
  created_at: string;
}

export interface CreateMagicLinkParams {
  userId: string;
  email: string;
  expiresInSeconds?: number;
}

export interface MagicLinkResult {
  user: {
    /** User ID (API returns 'id', but some endpoints may still return 'user_id') */
    id?: string;
    /** @deprecated Use 'id' instead */
    user_id?: string;
    email: string;
    status: string;
    email_verified_at?: string | null;
    roles: Array<{ id: string; name: string }>;
  };
  session: {
    token: string;
    expires_at: string;
  };
}

// ============================================================================
// TOTP Types
// ============================================================================

export interface TotpCode {
  code: string;
  expires_at: string;
}

export interface CreateTotpParams {
  userId: string;
  email: string;
  expiresInSeconds?: number;
}

export interface TotpResult {
  user: {
    /** User ID (API returns 'id', but some endpoints may still return 'user_id') */
    id?: string;
    /** @deprecated Use 'id' instead */
    user_id?: string;
    email: string;
    status: string;
    roles: Array<{ id: string; name: string }>;
  };
  session: {
    token: string;
    expires_at: string;
  };
}

// ============================================================================
// Passkey Types
// ============================================================================

export interface PasskeyChallenge {
  challenge: string;
  expires_at: string;
}

export interface Passkey {
  passkey_id: string;
  credential_id: string;
  name: string;
  device_type: string;
  backed_up: boolean;
  transports: string[];
  last_used_at?: string | null;
  created_at: string;
}

export interface RegisterPasskeyParams {
  userId: string;
  credentialId: string;
  credentialPublicKey: string;
  counter?: number;
  deviceType: string;
  backedUp?: boolean;
  transports?: string[];
  aaguid?: string;
  name: string;
}

export interface PasskeyAuthResult {
  user: {
    /** User ID (API returns 'id', but some endpoints may still return 'user_id') */
    id?: string;
    /** @deprecated Use 'id' instead */
    user_id?: string;
    email: string;
    status: string;
    roles: Array<{ id: string; name: string }>;
  };
  session: {
    token: string;
    expires_at: string;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function authFetch(
  path: string,
  options: AuthClientOptions,
  init: RequestInit = {}
): Promise<Response> {
  const baseUrl = options.authzUrl || DEFAULT_AUTHZ_URL;
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };

  // Zero Trust: Add access token if provided
  if (options.accessToken) {
    headers['Authorization'] = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Auth error (${response.status}): ${errorText}`);
  }

  return response;
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Create a session in authz.
 * Used by applications to create sessions after authentication (e.g., passkey login).
 */
export async function createSession(
  params: CreateSessionParams,
  options: AuthClientOptions = {}
): Promise<Session> {
  const response = await authFetch('/auth/sessions', options, {
    method: 'POST',
    body: JSON.stringify({
      user_id: params.userId,
      token: params.token,
      expires_at: params.expiresAt,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    }),
  });
  return await response.json();
}

/**
 * Validate a session by token.
 * Returns the session with user info if valid, null if not found/expired.
 */
export async function validateSession(
  token: string,
  options: AuthClientOptions = {}
): Promise<Session | null> {
  try {
    const response = await authFetch(`/auth/sessions/${encodeURIComponent(token)}`, options, {
      method: 'GET',
    });
    return await response.json();
  } catch (error) {
    // 404 means session not found or expired
    return null;
  }
}

/**
 * Delete a session (logout).
 */
export async function deleteSession(
  token: string,
  options: AuthClientOptions = {}
): Promise<boolean> {
  try {
    await authFetch(`/auth/sessions/${encodeURIComponent(token)}`, options, {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete all sessions for a user (logout everywhere).
 */
export async function deleteUserSessions(
  userId: string,
  options: AuthClientOptions = {}
): Promise<number> {
  const response = await authFetch(`/auth/sessions/user/${userId}`, options, {
    method: 'DELETE',
  });
  const result = await response.json();
  return result.deleted_count || 0;
}

// ============================================================================
// Magic Links
// ============================================================================

/**
 * Create a magic link for passwordless login.
 * The token should be sent to the user's email by the calling application.
 */
export async function createMagicLink(
  params: CreateMagicLinkParams,
  options: AuthClientOptions = {}
): Promise<MagicLink> {
  const response = await authFetch('/auth/magic-links', options, {
    method: 'POST',
    body: JSON.stringify({
      user_id: params.userId,
      email: params.email,
      expires_in_seconds: params.expiresInSeconds || 900,
    }),
  });
  return await response.json();
}

/**
 * Validate a magic link (without consuming it).
 * Returns the magic link info if valid, null otherwise.
 */
export async function validateMagicLink(
  token: string,
  options: AuthClientOptions = {}
): Promise<MagicLink | null> {
  try {
    const response = await authFetch(`/auth/magic-links/${encodeURIComponent(token)}`, options, {
      method: 'GET',
    });
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Use (consume) a magic link.
 * - Marks the link as used
 * - Activates the user if pending
 * - Sets email_verified_at
 * - Creates a new session
 * 
 * Returns the user and session, or null if invalid.
 */
export async function useMagicLink(
  token: string,
  options: AuthClientOptions = {}
): Promise<MagicLinkResult | null> {
  try {
    const response = await authFetch(`/auth/magic-links/${encodeURIComponent(token)}/use`, options, {
      method: 'POST',
    });
    return await response.json();
  } catch (error) {
    console.error('[AUTH] useMagicLink failed:', error);
    return null;
  }
}

// ============================================================================
// TOTP Codes
// ============================================================================

/**
 * Create a TOTP code for multi-device login.
 * Returns the plaintext code to be sent via email.
 */
export async function createTotpCode(
  params: CreateTotpParams,
  options: AuthClientOptions = {}
): Promise<TotpCode> {
  const response = await authFetch('/auth/totp', options, {
    method: 'POST',
    body: JSON.stringify({
      user_id: params.userId,
      email: params.email,
      expires_in_seconds: params.expiresInSeconds || 300,
    }),
  });
  return await response.json();
}

/**
 * Verify a TOTP code and create a session.
 * Returns user and session if valid, null otherwise.
 */
export async function verifyTotpCode(
  email: string,
  code: string,
  options: AuthClientOptions = {}
): Promise<TotpResult | null> {
  try {
    const response = await authFetch('/auth/totp/verify', options, {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    return await response.json();
  } catch (error) {
    console.error('[AUTH] verifyTotpCode failed:', error);
    return null;
  }
}

// ============================================================================
// Passkeys (WebAuthn)
// ============================================================================

/**
 * Create a passkey challenge for registration or authentication.
 */
export async function createPasskeyChallenge(
  type: 'registration' | 'authentication',
  userId?: string,
  options: AuthClientOptions = {}
): Promise<PasskeyChallenge> {
  const response = await authFetch('/auth/passkeys/challenge', options, {
    method: 'POST',
    body: JSON.stringify({ type, user_id: userId }),
  });
  return await response.json();
}

/**
 * Register a new passkey for a user.
 */
export async function registerPasskey(
  params: RegisterPasskeyParams,
  options: AuthClientOptions = {}
): Promise<Passkey> {
  const response = await authFetch('/auth/passkeys', options, {
    method: 'POST',
    body: JSON.stringify({
      user_id: params.userId,
      credential_id: params.credentialId,
      credential_public_key: params.credentialPublicKey,
      counter: params.counter || 0,
      device_type: params.deviceType,
      backed_up: params.backedUp || false,
      transports: params.transports || [],
      aaguid: params.aaguid,
      name: params.name,
    }),
  });
  return await response.json();
}

/**
 * List all passkeys for a user.
 */
export async function listUserPasskeys(
  userId: string,
  options: AuthClientOptions = {}
): Promise<Passkey[]> {
  const response = await authFetch(`/auth/passkeys/user/${userId}`, options, {
    method: 'GET',
  });
  const result = await response.json();
  return result.passkeys || [];
}

/**
 * Delete a passkey.
 */
export async function deletePasskey(
  passkeyId: string,
  options: AuthClientOptions = {}
): Promise<boolean> {
  try {
    await authFetch(`/auth/passkeys/${passkeyId}`, options, {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticate with a passkey.
 * 
 * Note: The caller is responsible for:
 * 1. Getting the challenge from createPasskeyChallenge()
 * 2. Calling navigator.credentials.get() in the browser
 * 3. Verifying the signature against the stored public key
 * 4. Calling this endpoint with the credential_id and new_counter
 */
export async function authenticateWithPasskey(
  credentialId: string,
  newCounter: number,
  options: AuthClientOptions = {}
): Promise<PasskeyAuthResult | null> {
  try {
    const response = await authFetch('/auth/passkeys/authenticate', options, {
      method: 'POST',
      body: JSON.stringify({
        credential_id: credentialId,
        new_counter: newCounter,
      }),
    });
    return await response.json();
  } catch {
    return null;
  }
}

// ============================================================================
// Login Initiation (Public - single atomic endpoint)
// ============================================================================

/**
 * Response from the login initiation endpoint.
 *
 * Authz handles the full flow server-side (generates tokens AND sends the
 * email via bridge-api) so the response intentionally contains NO secrets.
 */
export interface LoginInitiateResult {
  /** Confirmation message (always "ok") */
  message: string;
  /** Seconds until the magic-link / TOTP code expires */
  expires_in: number;
}

/**
 * Initiate login for an email address.
 * 
 * This is the ONLY public endpoint for login initiation. It:
 * 1. Validates email format and domain
 * 2. Looks up or creates user (PENDING status for new users)
 * 3. Creates magic link token and TOTP code
 * 4. Sends the email via bridge-api (server-to-server)
 * 5. Returns a simple success message — no tokens leave the backend
 * 
 * NEVER leaks whether an email/user exists - always returns same structure.
 * 
 * @param email - The email address to login
 * @param options - Auth client options (only authzUrl is used)
 * @returns Simple success acknowledgement (no tokens)
 */
export async function initiateLogin(
  email: string,
  options: AuthClientOptions = {}
): Promise<LoginInitiateResult> {
  const baseUrl = options.authzUrl || DEFAULT_AUTHZ_URL;
  const url = `${baseUrl}/auth/login/initiate`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase().trim() }),
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Login initiation failed (${response.status}): ${errorText}`);
  }
  
  return await response.json();
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up expired sessions, magic links, TOTP codes, and passkey challenges.
 * Should be called periodically by a scheduled job.
 */
export async function cleanupExpired(options: AuthClientOptions = {}): Promise<{
  sessions: number;
  magic_links: number;
  totp_codes: number;
  passkey_challenges: number;
}> {
  const response = await authFetch('/auth/cleanup', options, {
    method: 'POST',
  });
  const result = await response.json();
  return result.cleaned || { sessions: 0, magic_links: 0, totp_codes: 0, passkey_challenges: 0 };
}

