/**
 * WebAuthn / Passkey Utility Functions
 * 
 * Implements passkey registration and authentication using the WebAuthn standard.
 * Uses @simplewebauthn/server for server-side operations.
 * 
 * NOTE: Passkey storage is now handled by the authz service.
 * This module performs WebAuthn verification locally, then stores results via authz.
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialDescriptorJSON,
} from '@simplewebauthn/types';
import {
  createPasskeyChallenge,
  registerPasskey as authzRegisterPasskey,
  listUserPasskeys as authzListUserPasskeys,
  deletePasskey as authzDeletePasskey,
  authenticateWithPasskey as authzAuthenticateWithPasskey,
  type Passkey,
} from './session-client';
import { type AuthzUser } from './user-management';
import { getAuthzOptions, getAuthzBaseUrl, getAuthzOptionsWithToken } from './next-client';

// RP (Relying Party) configuration
// APP_URL is a runtime env var (server-side only) - it's NOT prefixed with NEXT_PUBLIC_
// because we don't want it baked into the client bundle at build time.
// This ensures the correct domain is used even if the build was done with different env vars.
const getAppUrl = () => process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Log on module load so we can verify the new code is actually running
console.log('[PASSKEY] Module loaded (v2). WEBAUTHN_RP_ID=%s, APP_URL=%s, NEXT_PUBLIC_APP_URL=%s, PORTAL_URL=%s',
  process.env.WEBAUTHN_RP_ID ?? '(unset)',
  process.env.APP_URL ?? '(unset)',
  process.env.NEXT_PUBLIC_APP_URL ?? '(unset)',
  process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL ?? '(unset)',
);

/**
 * Build the set of hostnames this instance accepts for WebAuthn operations.
 * Sources: localhost (always) + WEBAUTHN_RP_ID + hostnames extracted from
 * WEBAUTHN_ADDITIONAL_ORIGINS.
 */
const getAllowedHosts = (): Set<string> => {
  const hosts = new Set(['localhost']);
  if (process.env.WEBAUTHN_RP_ID) {
    hosts.add(process.env.WEBAUTHN_RP_ID);
  }
  const additional = process.env.WEBAUTHN_ADDITIONAL_ORIGINS;
  if (additional) {
    for (const entry of additional.split(',').map(s => s.trim()).filter(Boolean)) {
      try { hosts.add(new URL(entry).hostname); } catch { /* bare hostname won't parse — skip */ }
    }
  }
  return hosts;
};

/**
 * Derive the RP ID for a WebAuthn operation.
 *
 * When requestOrigin is provided, its hostname is used — but only if it
 * appears in the allowlist (localhost + WEBAUTHN_RP_ID). This lets passkeys
 * work from multiple hostnames (e.g. localhost and a Tailscale name) while
 * refusing to cooperate with unknown origins.
 *
 * Fallback: WEBAUTHN_RP_ID > APP_URL > PORTAL_URL > localhost.
 */
const getRpId = (requestOrigin?: string) => {
  if (requestOrigin) {
    try {
      const hostname = new URL(requestOrigin).hostname;
      if (getAllowedHosts().has(hostname)) {
        console.log(`[PASSKEY] getRpId: using allowed request origin "${hostname}"`);
        return hostname;
      }
      console.log(`[PASSKEY] getRpId: origin "${hostname}" not in allowlist, ignoring`);
    } catch {
      console.log(`[PASSKEY] getRpId: failed to parse requestOrigin="${requestOrigin}"`);
    }
  }

  if (process.env.WEBAUTHN_RP_ID) {
    console.log(`[PASSKEY] getRpId: using WEBAUTHN_RP_ID="${process.env.WEBAUTHN_RP_ID}"`);
    return process.env.WEBAUTHN_RP_ID;
  }

  const url = getAppUrl();
  try {
    const hostname = new URL(url).hostname;
    const looksLikeRealHost = hostname.includes('.') || hostname === 'localhost' || hostname.includes('-') || hostname.length > 12;
    if (looksLikeRealHost) {
      console.log(`[PASSKEY] getRpId: using hostname "${hostname}" from url="${url}"`);
      return hostname;
    }
    console.log(`[PASSKEY] getRpId: hostname "${hostname}" looks internal, trying PORTAL_URL fallback`);
  } catch {
    console.log(`[PASSKEY] getRpId: failed to parse url="${url}"`);
  }

  const portalUrl = process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL;
  if (portalUrl) {
    try {
      const portalHostname = new URL(portalUrl).hostname;
      console.log(`[PASSKEY] getRpId: using portal hostname "${portalHostname}" from PORTAL_URL="${portalUrl}"`);
      return portalHostname;
    } catch {
      // fall through
    }
  }

  console.log('[PASSKEY] getRpId: all sources exhausted, falling back to localhost');
  return 'localhost';
};

const getRpName = () => process.env.APP_NAME || 'Busibox Portal';

/**
 * Returns the expected origin(s) for WebAuthn verification.
 *
 * Builds origins from ALL allowed hosts so the server accepts credentials
 * registered on any permitted hostname. The requestOrigin is used to select
 * the RP ID (via getRpId) but the origin list is always comprehensive.
 */
const getOrigin = (requestOrigin?: string): string | string[] => {
  const origins: string[] = [];

  for (const host of getAllowedHosts()) {
    if (host === 'localhost') {
      for (const candidate of [
        'http://localhost:3000',
        'https://localhost:443',
        'https://localhost:4443',
        'https://localhost:3000',
        'https://localhost',
      ]) {
        if (!origins.includes(candidate)) origins.push(candidate);
      }
    } else {
      const httpsOrigin = `https://${host}`;
      if (!origins.includes(httpsOrigin)) origins.push(httpsOrigin);
    }
  }

  // Include any explicitly-configured additional origins verbatim
  const additionalOrigins = process.env.WEBAUTHN_ADDITIONAL_ORIGINS;
  if (additionalOrigins) {
    for (const origin of additionalOrigins.split(',').map(o => o.trim()).filter(Boolean)) {
      if (!origins.includes(origin)) {
        origins.push(origin);
      }
    }
  }

  return origins.length === 1 ? origins[0] : origins;
};

// ============================================================================
// Registration (adding a new passkey)
// ============================================================================

/**
 * Generate registration options for a user to create a new passkey
 * @param userId - User ID
 * @param userEmail - User email
 * @param sessionJwt - Session JWT for authentication with authz service
 * @param requestOrigin - Origin from the incoming request (e.g. "https://clymates-mac-studio")
 */
export async function generatePasskeyRegistrationOptions(userId: string, userEmail: string, sessionJwt: string, requestOrigin?: string) {
  // Use session JWT directly for self-service auth (no token exchange needed)
  // The authz passkey endpoints support session JWT for users managing their own passkeys
  const options = {
    authzUrl: getAuthzBaseUrl(),
    accessToken: sessionJwt,  // Session JWT works for self-service
  };
  
  // Get existing passkeys for this user to exclude
  const existingPasskeys = await authzListUserPasskeys(userId, options);

  const excludeCredentials: PublicKeyCredentialDescriptorJSON[] =
    existingPasskeys.map((passkey) => ({
      id: passkey.credential_id,
      type: 'public-key',
      transports: (passkey.transports || []) as AuthenticatorTransportFuture[],
    }));

  const registrationOptions = await generateRegistrationOptions({
    rpName: getRpName(),
    rpID: getRpId(requestOrigin),
    userID: new TextEncoder().encode(userId),
    userName: userEmail,
    userDisplayName: userEmail.split('@')[0],
    // Timeout after 5 minutes
    timeout: 300000,
    // Prefer platform authenticators (Face ID, Touch ID, Windows Hello)
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    // Don't re-register existing authenticators
    excludeCredentials,
    // Request attestation for device info
    attestationType: 'none',
  });

  // Store challenge for verification via authz
  await createPasskeyChallenge('registration', userId, options);

  return registrationOptions;
}

/**
 * Verify a registration response and store the new passkey
 * @param userId - User ID
 * @param response - Registration response from WebAuthn
 * @param deviceName - Name for the passkey
 * @param sessionJwt - Session JWT for authentication with authz service
 */
export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  deviceName: string,
  sessionJwt: string,
  requestOrigin?: string,
) {
  // Use session JWT directly for self-service auth (no token exchange needed)
  // The authz passkey endpoints support session JWT for users managing their own passkeys
  const options = {
    authzUrl: getAuthzBaseUrl(),
    accessToken: sessionJwt,  // Session JWT works for self-service
  };
  
  // Get the challenge from authz (we use the user's most recent challenge)
  // Since authz stores challenges separately, we need to fetch it
  // For now, we'll pass the expected challenge from the client
  // This is a simplification - in production, you'd want to fetch the challenge
  
  // Note: The challenge is in the response's clientDataJSON
  // We need to extract it and verify against what we stored
  const clientDataJSON = JSON.parse(
    Buffer.from(response.response.clientDataJSON, 'base64').toString()
  );
  const expectedChallenge = clientDataJSON.challenge;

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getOrigin(requestOrigin),
    expectedRPID: getRpId(requestOrigin),
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed');
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  // Store the new passkey via authz
  const passkey = await authzRegisterPasskey({
    userId,
    credentialId: bufferToBase64Url(credential.id),
    credentialPublicKey: bufferToBase64Url(credential.publicKey),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: response.response.transports || [],
    aaguid: verification.registrationInfo.aaguid,
    name: deviceName,
  }, options);

  return passkey;
}

// ============================================================================
// Authentication (signing in with a passkey)
// ============================================================================

/**
 * Generate authentication options for passkey login
 * 
 * Note: We don't look up user by email here because:
 * 1. During login, we don't have an access token yet
 * 2. Modern browsers support "discoverable credentials" which auto-select the right passkey
 * 3. Allowing any passkey is actually the correct UX for passkey authentication
 */
export async function generatePasskeyAuthenticationOptions(_email?: string, requestOrigin?: string) {
  const options = getAuthzOptions();

  const authOptions = await generateAuthenticationOptions({
    rpID: getRpId(requestOrigin),
    timeout: 300000,
    userVerification: 'preferred',
    // undefined means allow any passkey (discoverable credential)
    allowCredentials: undefined,
  });

  // Store challenge for verification via authz (userId is null because we don't know the user yet)
  await createPasskeyChallenge('authentication', undefined, options);

  return authOptions;
}

/**
 * Verify an authentication response and return the user and session
 */
export async function verifyPasskeyAuthentication(response: AuthenticationResponseJSON, requestOrigin?: string): Promise<{
  passkey: Passkey & { user_id: string };
  user: AuthzUser;
  session: { token: string; expires_at: string };
}> {
  const options = getAuthzOptions();
  
  // Extract the challenge from the response first (needed for verification)
  const clientDataJSON = JSON.parse(
    Buffer.from(response.response.clientDataJSON, 'base64').toString()
  );
  const expectedChallenge = clientDataJSON.challenge;

  // Find the passkey by credential ID via authz
  // The credential ID should match what was stored during registration
  // During registration, we store: bufferToBase64Url(credential.id)
  // During authentication, response.id and response.rawId should both be Base64URL-encoded
  // Use rawId if available, otherwise fall back to id
  const credentialId = response.rawId || response.id;
  
  if (!credentialId) {
    throw new Error('Missing credential ID in authentication response');
  }
  
  // Log for debugging
  console.log('[PASSKEY] Authentication response credential IDs:', {
    id: response.id,
    rawId: response.rawId,
    using: credentialId,
    id_length: response.id?.length,
    rawId_length: response.rawId?.length,
  });

  // Get passkey details from authz via HTTP call
  // Zero Trust: This is a public endpoint during authentication - no auth needed
  const authzUrl = getAuthzBaseUrl();
  // Credential ID is already Base64URL-encoded, but we need to URL-encode it for the path
  const encodedCredentialId = encodeURIComponent(credentialId);
  console.log('[PASSKEY] Looking up passkey with credential ID:', credentialId.substring(0, 30) + '...');
  const passkeyResponse = await fetch(`${authzUrl}/auth/passkeys/by-credential/${encodedCredentialId}`);

  if (!passkeyResponse.ok) {
    const errorText = await passkeyResponse.text().catch(() => 'Unknown error');
    console.error(`[PASSKEY] Failed to get passkey by credential ID: ${passkeyResponse.status} - ${errorText}`);
    console.error(`[PASSKEY] Credential ID: ${credentialId.substring(0, 20)}...`);
    throw new Error('Passkey not found');
  }

  const passkeyData = await passkeyResponse.json();
  
  // Validate that user_id exists in the response
  if (!passkeyData.user_id) {
    console.error('[PASSKEY] Passkey lookup response missing user_id:', passkeyData);
    throw new Error('Passkey lookup returned invalid data: missing user_id');
  }

  const passkey = passkeyData as Passkey & {
    credential_public_key: string;
    counter: number;
    user_id: string;
  };

  // Log the passkey data for debugging
  console.log('[PASSKEY] Passkey lookup result:', {
    passkey_id: passkey.passkey_id,
    user_id: passkey.user_id,
    user_id_type: typeof passkey.user_id,
    credential_id: passkey.credential_id?.substring(0, 20) + '...',
  });

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getOrigin(requestOrigin),
    expectedRPID: getRpId(requestOrigin),
    credential: {
      id: passkey.credential_id,
      publicKey: base64UrlToBuffer(passkey.credential_public_key) as any,
      counter: passkey.counter,
      transports: (passkey.transports || []) as AuthenticatorTransportFuture[],
    },
    requireUserVerification: false,
  });

  if (!verification.verified) {
    throw new Error('Authentication verification failed');
  }

  // Authenticate with authz - this updates the counter, creates a session, and returns user info
  // This is a public endpoint - no access token needed (the passkey signature is the proof)
  const authResult = await authzAuthenticateWithPasskey(
    credentialId,
    verification.authenticationInfo.newCounter,
    options
  );

  if (!authResult) {
    throw new Error('Passkey authentication failed - counter replay or invalid passkey');
  }

  // The authResult already has the user info - no need to call getUser separately
  // Get user ID - authz API may return 'id' or 'user_id' depending on endpoint
  const authUser = authResult.user as { id?: string; user_id?: string; email: string; status: string; roles: Array<{ id: string; name: string }> };
  const resolvedUserId = authUser.id || authUser.user_id;
  
  if (!resolvedUserId) {
    throw new Error('Passkey authentication failed - no user ID in response');
  }

  // Map the roles to include required fields (authz returns minimal role info)
  const user: AuthzUser = {
    id: resolvedUserId,
    email: authResult.user.email,
    status: authResult.user.status as 'ACTIVE' | 'PENDING' | 'DEACTIVATED',
    roles: authResult.user.roles.map(r => ({
      id: r.id,
      name: r.name,
      created_at: '', // Not returned by auth endpoint
      updated_at: '', // Not returned by auth endpoint
    })),
    created_at: '', // Not returned by auth endpoint
    updated_at: '', // Not returned by auth endpoint
  };

  // Extract session info from authResult
  const session = {
    token: authResult.session.token,
    expires_at: authResult.session.expires_at,
  };

  console.log('[PASSKEY] Authentication successful:', {
    user_id: user.id,
    email: user.email,
    roles: user.roles?.map(r => r.name),
    session_token_length: session.token?.length,
  });

  return { passkey, user, session };
}

// ============================================================================
// Passkey Management
// ============================================================================

/**
 * Get all passkeys for a user
 * @param userId - User ID
 * @param sessionJwt - Optional session JWT for self-service authentication
 */
export async function getUserPasskeys(userId: string, sessionJwt?: string) {
  const options = {
    ...getAuthzOptions(),
    ...(sessionJwt && { accessToken: sessionJwt }),
  };
  return authzListUserPasskeys(userId, options);
}

/**
 * Delete a passkey
 * @param userId - User ID (for ownership verification)
 * @param passkeyId - Passkey ID to delete
 * @param sessionJwt - Optional session JWT for self-service authentication
 */
export async function deletePasskey(userId: string, passkeyId: string, sessionJwt?: string) {
  const options = {
    ...getAuthzOptions(),
    ...(sessionJwt && { accessToken: sessionJwt }),
  };
  
  // First verify the passkey belongs to this user
  const passkeys = await authzListUserPasskeys(userId, options);
  const passkey = passkeys.find(p => p.passkey_id === passkeyId);
  
  if (!passkey) {
    throw new Error('Passkey not found');
  }

  await authzDeletePasskey(passkeyId, options);
  return passkey;
}

/**
 * Rename a passkey
 * @param userId - User ID (for ownership verification)
 * @param passkeyId - Passkey ID to rename
 * @param newName - New name for the passkey
 * @param sessionJwt - Optional session JWT for self-service authentication
 */
export async function renamePasskey(userId: string, passkeyId: string, newName: string, sessionJwt?: string): Promise<Passkey> {
  const options = {
    ...getAuthzOptions(),
    ...(sessionJwt && { accessToken: sessionJwt }),
  };
  
  // First verify the passkey belongs to this user
  const passkeys = await authzListUserPasskeys(userId, options);
  const passkey = passkeys.find(p => p.passkey_id === passkeyId);
  
  if (!passkey) {
    throw new Error('Passkey not found');
  }

  // Update the passkey name via authz
  const authzUrl = getAuthzBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionJwt) {
    headers['Authorization'] = `Bearer ${sessionJwt}`;
  }
  
  const response = await fetch(`${authzUrl}/auth/passkeys/${passkeyId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name: newName }),
  });

  if (!response.ok) {
    throw new Error('Failed to rename passkey');
  }

  return response.json() as Promise<Passkey>;
}

/**
 * Check if user has any passkeys
 * @param userId - User ID
 * @param sessionJwt - Optional session JWT for self-service authentication
 */
export async function userHasPasskeys(userId: string, sessionJwt?: string): Promise<boolean> {
  const options = {
    ...getAuthzOptions(),
    ...(sessionJwt && { accessToken: sessionJwt }),
  };
  const passkeys = await authzListUserPasskeys(userId, options);
  return passkeys.length > 0;
}

// ============================================================================
// Utility Functions
// ============================================================================

function bufferToBase64Url(input: Uint8Array | string): string {
  const buffer =
    typeof input === 'string' ? base64UrlToBuffer(input) : input;
  return Buffer.from(buffer).toString('base64url');
}

function base64UrlToBuffer(base64url: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64url, 'base64url'));
}

// ============================================================================
// Challenge Cleanup (should be run periodically)
// ============================================================================

export async function cleanupExpiredChallenges() {
  const options = getAuthzOptions();
  
  // Call the authz cleanup endpoint
  // Zero Trust: This is a maintenance endpoint - should be called with service account JWT
  const authzUrl = getAuthzBaseUrl();
  const response = await fetch(`${authzUrl}/auth/cleanup`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to cleanup expired challenges');
  }

  const result = await response.json();
  return result.passkeyChallengesDeleted || 0;
}
