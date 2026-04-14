/**
 * POST /api/auth/passkey/authenticate/verify
 * 
 * Verify WebAuthn authentication response and create session.
 * Does not require authentication (this is for login).
 * 
 * NOTE: User activation and session management is handled by authz service.
 * The authenticateWithPasskey endpoint in authz automatically:
 * - Activates pending users
 * - Updates last_login_at
 * - Creates a session
 * - Returns a signed session JWT
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiError, parseJsonBody, getIpAddress, getUserAgent } from '@jazzmind/busibox-app/lib/next/middleware';
import { verifyPasskeyAuthentication } from '@jazzmind/busibox-app/lib/authz/passkey';
import { logPasskeyLogin, logPasskeyLoginFailed } from '@jazzmind/busibox-app/lib/authz/audit';

export async function POST(request: NextRequest) {
  const ipAddress = getIpAddress(request);
  const userAgent = getUserAgent(request);

  try {
    const body = await parseJsonBody(request);
    if (!body || !body.response) {
      return apiError('Missing authentication response', 400);
    }

    const { response } = body;

    const requestOrigin = request.headers.get('origin') || undefined;
    const { passkey, user, session } = await verifyPasskeyAuthentication(response, requestOrigin);
    
    const userId = user.id || passkey.user_id;
    
    if (!userId) {
      console.error('[API] Missing user_id in passkey authentication:', { 
        user: user, 
        passkey: { passkey_id: passkey.passkey_id, user_id: passkey.user_id } 
      });
      return apiError('Invalid user data', 500);
    }

    // Check if user is deactivated (authz returns the current status)
    if (user.status === 'DEACTIVATED') {
      await logPasskeyLoginFailed(user.email, 'Account deactivated', ipAddress, userAgent);
      return apiError('Your account has been deactivated', 403);
    }

    // Log successful passkey login
    await logPasskeyLogin(userId, passkey.passkey_id, 'authz-session', ipAddress, userAgent);
    
    // Create response with session cookie
    const jsonResponse = NextResponse.json({
      success: true,
      data: {
        message: 'Authentication successful',
        userId,
        email: user.email,
      },
    });

    // Set session cookie with JWT from authz
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    };

    // Set the session JWT from authz as the session cookie
    jsonResponse.cookies.set('busibox-session', session.token, cookieOptions);

    return jsonResponse;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Passkey authentication verify error:', error);
    await logPasskeyLoginFailed('unknown', errorMessage, ipAddress, userAgent);
    return apiError(errorMessage || 'Authentication failed', 400);
  }
}
