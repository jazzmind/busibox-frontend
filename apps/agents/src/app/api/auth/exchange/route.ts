import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isTokenExpired } from '@jazzmind/busibox-app/lib/authz/auth-helper';

/**
 * POST /api/auth/exchange
 *
 * Exchange an SSO token from portal for a session.
 * Rejects expired tokens so the client can redirect to portal with reason=token_expired.
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

    if (isTokenExpired(token)) {
      return NextResponse.json(
        { error: 'token_expired', message: 'Token has expired. Please open the app again from the portal to get a fresh token.' },
        { status: 401 }
      );
    }

    // Store token in httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 6, // 6 hours (match SSO token expiry)
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AUTH] Token exchange error:', error);
    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
