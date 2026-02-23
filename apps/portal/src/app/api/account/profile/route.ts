import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const response = await fetch(`${getAuthzBaseUrl()}/me`, {
      method: 'GET',
      // /me is self-service and expects the session JWT (aud=busibox-portal),
      // not an exchanged authz-api access token.
      headers: { Authorization: `Bearer ${auth.sessionJwt}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json(
        { success: false, error: `Failed to fetch profile: ${message}` },
        { status: response.status }
      );
    }

    const profile = await response.json();
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch profile');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();

    const response = await fetch(`${getAuthzBaseUrl()}/me`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${auth.sessionJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json(
        { success: false, error: `Failed to update profile: ${message}` },
        { status: response.status }
      );
    }

    const profile = await response.json();

    // After updating the profile, refresh the session JWT so that
    // navbar/header components across all apps see the updated
    // display name, avatar, etc. without requiring a full re-login.
    let refreshedSessionJwt: string | null = null;
    try {
      console.log('[Profile] Calling authz /me/refresh-session to get updated JWT...');
      const refreshResponse = await fetch(`${getAuthzBaseUrl()}/me/refresh-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.sessionJwt}`,
          'Content-Type': 'application/json',
        },
      });
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        refreshedSessionJwt = refreshData.session_jwt;
        console.log('[Profile] Got refreshed session JWT (length:', refreshedSessionJwt?.length, ')');
      } else {
        const errText = await refreshResponse.text();
        console.warn('[Profile] Failed to refresh session JWT:', refreshResponse.status, errText);
      }
    } catch (refreshError) {
      console.warn('[Profile] Session refresh failed (non-fatal):', refreshError);
    }

    const res = NextResponse.json({ success: true, profile, sessionRefreshed: !!refreshedSessionJwt });

    // Set the refreshed session cookie so subsequent requests use the new JWT
    if (refreshedSessionJwt) {
      console.log('[Profile] Setting busibox-session cookie with refreshed JWT');
      res.cookies.set('busibox-session', refreshedSessionJwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    } else {
      console.warn('[Profile] No refreshed JWT available - session cookie NOT updated');
    }

    return res;
  } catch (error) {
    return handleApiError(error, 'Failed to update profile');
  }
}
