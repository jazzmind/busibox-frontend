/**
 * GET /api/auth/verify-magic-link?token=xxx
 * 
 * Verify magic link token and create authenticated session.
 * All operations now go through the authz service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, getIpAddress, getUserAgent } from '@jazzmind/busibox-app/lib/next/middleware';
import { logMagicLinkUsed, logMagicLinkExpired, logUserLogin, logUserActivated } from '@jazzmind/busibox-app/lib/authz/audit';
import { useMagicLink } from '@jazzmind/busibox-app';
import { getAuthzOptions } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const ipAddress = getIpAddress(request);
    const userAgent = getUserAgent(request);

    if (!token) {
      return apiError('Token is required', 400);
    }

    // Use magic link via authz service
    // This will:
    // - Validate the token
    // - Mark it as used  
    // - Activate user if PENDING
    // - Set email_verified_at
    // - Create a new session
    const result = await useMagicLink(token, getAuthzOptions());

    if (!result) {
      await logMagicLinkExpired('Unknown');
      return apiError('Invalid or expired magic link', 401);
    }

    const { user, session } = result;

    // Check if user is deactivated
    if (user.status === 'DEACTIVATED') {
      return apiError('Your account has been deactivated', 403);
    }

    // Get user ID (authz API may return 'id' or 'user_id' depending on endpoint)
    const userAny = user as { id?: string; user_id?: string; email: string };
    const userId = userAny.id || userAny.user_id || user.user_id;

    // Log magic link used and login
    await logMagicLinkUsed(userId!, user.email);
    
    // Log activation if user was just activated
    if (user.email_verified_at) {
      const verifiedDate = new Date(user.email_verified_at);
      const now = new Date();
      // If email was verified within the last minute, this was an activation
      if (now.getTime() - verifiedDate.getTime() < 60000) {
        await logUserActivated(userId!, user.email);
      }
    }
    
    await logUserLogin(userId!, session.token);

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      data: {
        message: 'Authentication successful',
        userId: userId,
        email: user.email,
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
    console.error('[API] Verify magic link error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
