/**
 * Shared session route handler factory for sub-apps (agents, admin, chat,
 * documents, media, appbuilder).
 *
 * Each sub-app's auth/session route supports three operations:
 *   GET  — Return current session from app-scoped cookie
 *   POST {token} — SSO token exchange (set app-scoped cookies)
 *   POST {} — Token refresh (exchange SSO token for fresh API token)
 *
 * Usage in each app's api/auth/session/route.ts:
 *   import { createSessionRouteHandlers } from '@jazzmind/busibox-app/lib/authz/session-route-handlers';
 *   export const { GET, POST } = createSessionRouteHandlers('busibox-agents');
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionFromRequest,
  getTokenFromRequest,
  isTokenExpired,
  sanitizeAppName,
  validateSSOToken,
  createSessionFromSSO,
} from './index';
import { getApiToken } from './next-client';

interface CookieConfig {
  sessionCookieName: string;
  authCookieName: string;
  basePath: string;
  isProduction: boolean;
  authTokenMaxAge: number;
}

function getCookieConfig(appName: string): CookieConfig {
  const sanitized = sanitizeAppName(appName);
  const envMaxAge = process.env.SSO_COOKIE_MAX_AGE
    ? parseInt(process.env.SSO_COOKIE_MAX_AGE, 10)
    : null;
  return {
    sessionCookieName: `${sanitized}-session`,
    authCookieName: `${sanitized}-auth-token`,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/',
    isProduction: process.env.NODE_ENV === 'production',
    authTokenMaxAge: envMaxAge || 60 * 60 * 6, // 6 hours
  };
}

function extractUserFromSession(ssoSession: ReturnType<typeof getSessionFromRequest>) {
  if (!ssoSession) return null;
  return {
    id: ssoSession.userId,
    email: ssoSession.email,
    status: 'ACTIVE' as const,
    roles: ssoSession.roles,
    displayName: ssoSession.displayName,
    firstName: ssoSession.firstName,
    lastName: ssoSession.lastName,
    avatarUrl: ssoSession.avatarUrl,
    favoriteColor: ssoSession.favoriteColor,
  };
}

function extractUserFromJwt(payload: Record<string, unknown>) {
  const userId = (payload.sub || payload.user_id || payload.userId) as string | undefined;
  if (!userId) return null;

  const roles: string[] = Array.isArray(payload.roles)
    ? (payload.roles as Array<{ name?: string } | string>)
        .map((r) => (typeof r === 'string' ? r : r.name || ''))
        .filter(Boolean)
    : [];

  return {
    id: String(userId),
    email:
      (payload.email as string) ||
      (payload.preferred_username as string) ||
      String(userId),
    status: 'ACTIVE' as const,
    roles,
    displayName: typeof payload.name === 'string' ? payload.name : undefined,
    firstName: typeof payload.given_name === 'string' ? payload.given_name : undefined,
    lastName: typeof payload.family_name === 'string' ? payload.family_name : undefined,
    avatarUrl: typeof payload.picture === 'string' ? payload.picture : undefined,
    favoriteColor:
      typeof payload.favorite_color === 'string' ? payload.favorite_color : undefined,
  };
}

/**
 * Create GET and POST route handlers for a sub-app's /api/auth/session endpoint.
 *
 * @param appNameDefault - The default APP_NAME value (e.g. 'busibox-agents').
 *                         Overridden by process.env.APP_NAME at runtime.
 */
export function createSessionRouteHandlers(appNameDefault: string) {
  const APP_NAME = process.env.APP_NAME || appNameDefault;
  const VERBOSE = process.env.VERBOSE_AUTH_LOGGING === 'true';

  async function GET(request: NextRequest) {
    try {
      const ssoSession = getSessionFromRequest(request);
      const user = extractUserFromSession(ssoSession);
      if (user) {
        return NextResponse.json({ success: true, data: { user } });
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

      const jwtUser = extractUserFromJwt(payload);
      if (!jwtUser) {
        return NextResponse.json({ success: false, data: { user: null } });
      }

      return NextResponse.json({ success: true, data: { user: jwtUser } });
    } catch (error) {
      console.error('[auth/session] GET error:', error);
      return NextResponse.json({ success: false, data: { user: null } });
    }
  }

  async function POST(request: NextRequest) {
    let body: { token?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body -> treat as refresh
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
      const config = getCookieConfig(APP_NAME);

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
        console.log(
          `[auth/session] SSO exchange OK for ${session.userId}, cookies: ${config.sessionCookieName}, ${config.authCookieName}`,
        );
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

  return { GET, POST };
}
