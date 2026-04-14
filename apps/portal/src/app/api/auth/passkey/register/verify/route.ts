/**
 * POST /api/auth/passkey/register/verify
 * 
 * Verify WebAuthn registration response and store new passkey.
 * Requires authenticated user.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody, getSessionUser, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import { verifyPasskeyRegistration } from '@jazzmind/busibox-app/lib/authz/passkey';
import { logPasskeyRegistered } from '@jazzmind/busibox-app/lib/authz/audit';

export async function POST(request: NextRequest) {
  try {
    // Require authenticated user
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    // Get session JWT for authentication with authz service
    const sessionJwt = getSessionJwt(request);
    if (!sessionJwt) {
      return apiError('Session token required', 401);
    }

    const body = await parseJsonBody(request);
    if (!body || !body.response) {
      return apiError('Missing registration response', 400);
    }

    const { response, deviceName = 'My Device' } = body;

    const requestOrigin = request.headers.get('origin') || undefined;
    const passkey = await verifyPasskeyRegistration(user.id, response, deviceName, sessionJwt, requestOrigin);

    // Log the registration
    await logPasskeyRegistered(user.id, passkey.passkey_id, deviceName);

    return apiSuccess({
      message: 'Passkey registered successfully',
      passkey: {
        id: passkey.passkey_id,
        name: passkey.name,
        deviceType: passkey.device_type,
        createdAt: passkey.created_at,
      },
    });
  } catch (error: any) {
    console.error('[API] Passkey registration verify error:', error);
    return apiError(error.message || 'Failed to register passkey', 400);
  }
}
