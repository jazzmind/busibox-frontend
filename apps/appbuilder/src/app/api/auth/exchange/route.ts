import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/exchange
 * 
 * Exchange an SSO token from portal for a session.
 * This endpoint receives the JWT token from portal and stores it
 * in an httpOnly cookie for subsequent API requests.
 * 
 * IMPORTANT: We only set app-specific cookies here, NOT busibox-session.
 * The busibox-session is a domain-wide cookie managed by Busibox Portal and
 * should not be overwritten by individual apps.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Get app-specific basePath to scope the cookie
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/';

    // Store token in httpOnly cookie - scoped to this app's path
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: basePath, // Scope to this app's path
      maxAge: 60 * 60 * 6, // 6 hours (match SSO token expiry)
    });

    // NOTE: Do NOT set busibox-session here - that's the portal's domain-wide
    // session cookie and should not be overwritten by individual apps.
    // Apps should use auth_token or ${appName}-session for their own sessions.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AUTH] Token exchange error:', error);
    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
