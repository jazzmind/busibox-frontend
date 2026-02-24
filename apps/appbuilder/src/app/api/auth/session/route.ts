/**
 * Consolidated auth endpoint for busibox-appbuilder.
 *
 * GET  /api/auth/session        — Return current session (SessionProvider polling)
 * POST /api/auth/session {token} — SSO token exchange (SessionProvider initial load)
 * POST /api/auth/session {}      — Token refresh (AuthStateManager background refresh)
 *
 * All heavy lifting is delegated to @jazzmind/busibox-app libs.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionFromRequest,
  getTokenFromRequest,
  isTokenExpired,
  sanitizeAppName,
  validateSSOToken,
  createSessionFromSSO,
} from '@jazzmind/busibox-app/lib/authz';
import { getApiToken } from '@jazzmind/busibox-app/lib/authz/next-client';

const APP_NAME = process.env.APP_NAME || 'busibox-appbuilder';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/';
const VERBOSE = process.env.VERBOSE_AUTH_LOGGING === 'true';

function getCookieConfig() {
  const appName = sanitizeAppName(APP_NAME);
  const envMaxAge = process.env.SSO_COOKIE_MAX_AGE ? parseInt(process.env.SSO_COOKIE_MAX_AGE, 10) : null;
  return {
    sessionCookieName: `${appName}-session`,
    authCookieName: `${appName}-auth-token`,
    basePath: BASE_PATH,
    isProduction: process.env.NODE_ENV === 'production',
    authTokenMaxAge: envMaxAge || 60 * 60 * 6,
  };
}

// ---------------------------------------------------------------------------
// GET — Session check
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const ssoSession = getSessionFromRequest(request);
    if (ssoSession) {
      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: ssoSession.userId,
            email: ssoSession.email,
            status: 'ACTIVE',
            roles: ssoSession.roles,
            displayName: ssoSession.displayName,
            firstName: ssoSession.firstName,
            lastName: ssoSession.lastName,
            avatarUrl: ssoSession.avatarUrl,
            favoriteColor: ssoSession.favoriteColor,
          },
        },
      });
    }

    const token = getTokenFromRequest(request);
    if (!token || isTokenExpired(token)) {
      return NextResponse.json({ success: false, data: { user: null } });
    }

    let payload: Record<string, unknown>;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return NextResponse.json({ success: false, data: { user: null } });
      }
      payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return NextResponse.json({ success: false, data: { user: null } });
    }

    const userId = (payload.sub || payload.user_id || payload.userId) as string | undefined;
    if (!userId) {
      return NextResponse.json({ success: false, data: { user: null } });
    }

    const roles: string[] = Array.isArray(payload.roles)
      ? (payload.roles as Array<{ name?: string } | string>)
          .map((r) => (typeof r === 'string' ? r : r.name || ''))
          .filter(Boolean)
      : [];

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: String(userId),
          email: (payload.email as string) || (payload.preferred_username as string) || String(userId),
          status: 'ACTIVE',
          roles,
          displayName: typeof payload.name === 'string' ? payload.name : undefined,
          firstName: typeof payload.given_name === 'string' ? payload.given_name : undefined,
          lastName: typeof payload.family_name === 'string' ? payload.family_name : undefined,
          avatarUrl: typeof payload.picture === 'string' ? payload.picture : undefined,
          favoriteColor: typeof payload.favorite_color === 'string' ? payload.favorite_color : undefined,
        },
      },
    });
  } catch (error) {
    console.error('[auth/session] GET error:', error);
    return NextResponse.json({ success: false, data: { user: null } });
  }
}

// ---------------------------------------------------------------------------
// POST — SSO exchange (body has `token`) or token refresh (body empty)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: { token?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body → treat as refresh
  }

  if (body.token) {
    return handleSSOExchange(body.token);
  }
  return handleRefresh(request);
}

async function handleSSOExchange(token: string) {
  try {
    if (isTokenExpired(token)) {
      return NextResponse.json(
        { error: 'token_expired', message: 'Token has expired.' },
        { status: 401 },
      );
    }

    const validation = await validateSSOToken(token, { appName: APP_NAME });
    if (!validation.valid) {
      if (VERBOSE) console.log('[auth/session] SSO validation failed:', validation.error);
      return NextResponse.json(
        { success: false, error: 'Invalid token', details: validation.error },
        { status: 401 },
      );
    }

    const session = createSessionFromSSO(validation);
    const config = getCookieConfig();

    const response = NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        email: session.email,
        roles: session.roles,
        displayName: session.displayName,
        firstName: session.firstName,
        lastName: session.lastName,
        avatarUrl: session.avatarUrl,
        favoriteColor: session.favoriteColor,
      },
    });

    response.cookies.set(config.sessionCookieName, JSON.stringify(session), {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: config.basePath,
    });

    response.cookies.set(config.authCookieName, token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: config.authTokenMaxAge,
      path: config.basePath,
    });

    if (VERBOSE) {
      console.log(`[auth/session] SSO exchange OK for ${session.userId}, cookies: ${config.sessionCookieName}, ${config.authCookieName}`);
    }

    return response;
  } catch (error) {
    console.error('[auth/session] SSO exchange error:', error);
    return NextResponse.json({ success: false, error: 'SSO failed' }, { status: 500 });
  }
}

async function handleRefresh(request: NextRequest) {
  try {
    const ssoToken = getTokenFromRequest(request);

    if (!ssoToken) {
      return NextResponse.json(
        { error: 'No token to refresh', requiresReauth: true },
        { status: 401 },
      );
    }

    if (isTokenExpired(ssoToken)) {
      return NextResponse.json(
        { error: 'SSO token expired', requiresReauth: true },
        { status: 401 },
      );
    }

    const apiToken = await getApiToken(ssoToken, 'agent-api');

    return NextResponse.json({
      success: true,
      token: apiToken,
      expiresIn: 900,
    });
  } catch (error) {
    console.error('[auth/session] Refresh error:', error);

    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Invalid SSO token') || msg.includes('expired')) {
      return NextResponse.json(
        { error: 'Token refresh failed', requiresReauth: true },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: 'Token refresh failed', message: msg },
      { status: 500 },
    );
  }
}
