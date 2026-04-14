/**
 * POST /api/auth/passkey/authenticate/options
 * 
 * Generate WebAuthn authentication options for passkey login.
 * Does not require authentication (this is for login).
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import { generatePasskeyAuthenticationOptions } from '@jazzmind/busibox-app/lib/authz/passkey';

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request);
    
    // Email is optional - if provided, only allow that user's passkeys
    const email = body?.email;

    // Extract the origin so the RP ID matches the hostname the browser is on
    const requestOrigin = request.headers.get('origin') || undefined;
    const options = await generatePasskeyAuthenticationOptions(email, requestOrigin);

    return apiSuccess({
      options,
    });
  } catch (error) {
    console.error('[API] Passkey authentication options error:', error);
    return apiError('Failed to generate authentication options', 500);
  }
}










