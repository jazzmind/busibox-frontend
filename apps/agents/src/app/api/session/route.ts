import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, getSessionFromRequest, getUserRolesFromToken, parseJWTPayload, getUserIdFromToken, isTokenExpired } from '@jazzmind/busibox-app/lib/authz/auth-helper';

/**
 * GET /api/session
 *
 * Lightweight session endpoint for UI chrome (navbar/user dropdown).
 * Derives user identity from:
 * 1. busibox-agents-session cookie (set by SSO flow)
 * 2. JWT token (cookie or Authorization header)
 * 3. TEST_USER env vars (local dev fallback)
 */
export async function GET(request: NextRequest) {
  // First check for busibox-agents-session cookie (set by SSO flow)
  const ssoSession = getSessionFromRequest(request);
  if (ssoSession) {
    return NextResponse.json({
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
      isAuthenticated: true,
    });
  }
  
  const token = getTokenFromRequest(request);
  
  // If no token, check for test user (local dev)
  if (!token) {
    const testUserId = process.env.TEST_USER_ID;
    const testUserEmail = process.env.TEST_USER_EMAIL;
    
    if (testUserId && testUserEmail) {
      console.log('[SESSION] Using test user credentials for local development');
      return NextResponse.json({
        user: {
          id: testUserId,
          email: testUserEmail,
          status: 'ACTIVE',
          roles: ['Admin', 'User'], // Test user has all roles
        },
        isAuthenticated: true,
      });
    }
    
    return NextResponse.json({ user: null, isAuthenticated: false });
  }

  // Check if token is expired
  if (isTokenExpired(token)) {
    console.warn('[SESSION] Token is expired');
    return NextResponse.json({ user: null, isAuthenticated: false });
  }

  const payload = parseJWTPayload(token);
  if (!payload) {
    console.warn('[SESSION] Failed to parse JWT payload');
    return NextResponse.json({ user: null, isAuthenticated: false });
  }

  const roles = getUserRolesFromToken(token);
  const userId = getUserIdFromToken(token) || payload.sub || payload.user_id || payload.userId || null;

  const email =
    payload.email ||
    payload.preferred_username ||
    payload.upn ||
    payload.unique_name ||
    payload.username ||
    null;

  return NextResponse.json({
    user: userId
      ? {
          id: String(userId),
          email: email ? String(email) : String(userId),
          status: 'ACTIVE',
          roles,
          displayName: typeof payload.name === 'string' ? payload.name : undefined,
          firstName: typeof payload.given_name === 'string' ? payload.given_name : undefined,
          lastName: typeof payload.family_name === 'string' ? payload.family_name : undefined,
          avatarUrl: typeof payload.picture === 'string' ? payload.picture : undefined,
          favoriteColor: typeof payload.favorite_color === 'string' ? payload.favorite_color : undefined,
        }
      : null,
    isAuthenticated: Boolean(userId),
  });
}



