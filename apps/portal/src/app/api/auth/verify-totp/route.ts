/**
 * POST /api/auth/verify-totp
 * 
 * Verify TOTP code and create authenticated session.
 * Used for multi-device login when user can't click the magic link.
 * All operations now go through the authz service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, parseJsonBody, validateRequiredFields, getIpAddress, getUserAgent } from '@jazzmind/busibox-app/lib/next/middleware';
import { logTotpCodeUsed, logTotpCodeFailed, logUserLogin, logUserActivated } from '@jazzmind/busibox-app/lib/authz/audit';
import { verifyTotpCode } from '@jazzmind/busibox-app';
import { getAuthzOptions } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request);
    const ipAddress = getIpAddress(request);
    const userAgent = getUserAgent(request);

    // Validate request body
    const validationError = validateRequiredFields(body, ['email', 'code']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { email, code } = body;
    const normalizedEmail = email.toLowerCase().trim();

    // Verify TOTP code via authz service
    // This will:
    // - Validate the code (hash comparison)
    // - Mark it as used
    // - Activate user if PENDING
    // - Set email_verified_at
    // - Create a new session
    const result = await verifyTotpCode(normalizedEmail, code.trim(), getAuthzOptions());

    if (!result) {
      await logTotpCodeFailed(normalizedEmail, 'Invalid or expired code');
      return apiError('Invalid or expired code. Please request a new one.', 401);
    }

    const { user, session } = result;

    // Check if user is deactivated
    if (user.status === 'DEACTIVATED') {
      await logTotpCodeFailed(normalizedEmail, 'Account deactivated');
      return apiError('Your account has been deactivated', 403);
    }

    // Get user ID (authz API may return 'id' or 'user_id' depending on endpoint)
    const userAny = user as { id?: string; user_id?: string };
    const userId = userAny.id || userAny.user_id || user.user_id;

    // Log TOTP code used and login
    await logTotpCodeUsed(userId!, normalizedEmail);
    await logUserLogin(userId!, session.token);

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      data: {
        message: 'Authentication successful',
        userId: userId,
        email: normalizedEmail,
        sessionId: session.token,
      },
    });

    // Set session cookie with JWT
    const expiresAt = new Date(session.expires_at);
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: maxAge > 0 ? maxAge : 60 * 60 * 24, // Default to 24 hours if calculation fails
      path: '/',
    };
    
    // Set session cookie (Zero Trust JWT)
    response.cookies.set('busibox-session', session.token, cookieOptions);

    return response;
  } catch (error) {
    console.error('[API] Verify TOTP error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
