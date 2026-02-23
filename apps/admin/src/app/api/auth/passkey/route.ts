/**
 * GET /api/auth/passkey
 * 
 * List user's registered passkeys.
 * Requires authenticated user.
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { apiSuccess, apiError, getSessionUser } from '@jazzmind/busibox-app/lib/next/middleware';
import { listUserPasskeys } from '@jazzmind/busibox-app/lib/authz';
import { getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    // Require authenticated user
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    // Get session JWT from cookie for self-service auth
    const cookieStore = await cookies();
    const sessionJwt = cookieStore.get('busibox-session')?.value;
    
    if (!sessionJwt) {
      return apiError('Session not found', 401);
    }

    // Pass session JWT as accessToken for self-service passkey list
    const passkeys = await listUserPasskeys(user.id, {
      authzUrl: getAuthzBaseUrl(),
      accessToken: sessionJwt,
    });
    const hasPasskeys = passkeys.length > 0;

    return apiSuccess({
      passkeys,
      hasPasskeys,
    });
  } catch (error) {
    console.error('[API] Get passkeys error:', error);
    return apiError('Failed to get passkeys', 500);
  }
}










