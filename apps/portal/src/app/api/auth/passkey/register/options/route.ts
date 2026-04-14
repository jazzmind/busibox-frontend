/**
 * POST /api/auth/passkey/register/options
 * 
 * Generate WebAuthn registration options for adding a new passkey.
 * Requires authenticated user.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getSessionUser, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import { generatePasskeyRegistrationOptions } from '@jazzmind/busibox-app/lib/authz/passkey';

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

    const requestOrigin = request.headers.get('origin') || undefined;
    const options = await generatePasskeyRegistrationOptions(user.id, user.email, sessionJwt, requestOrigin);

    return apiSuccess({
      options,
    });
  } catch (error) {
    console.error('[API] Passkey registration options error:', error);
    const { handleApiError } = await import('@jazzmind/busibox-app/lib/next/middleware');
    return handleApiError(error, 'Failed to generate registration options');
  }
}










