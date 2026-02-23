import { NextRequest, NextResponse } from "next/server";
import { 
  getTokenFromRequest, 
  getSessionFromRequest, 
  getUserIdFromToken, 
  getUserRolesFromToken, 
  parseJWTPayload, 
  isTokenExpired 
} from "@jazzmind/busibox-app/lib/authz";

/**
 * Check if a string looks like a UUID
 */
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Extract a display-friendly email from various sources
 * If no email found, tries to create a friendly display name from the user ID
 */
function extractEmail(payload: Record<string, unknown>, userId: string | null): string {
  // Try various email claims
  const emailCandidates = [
    payload.email,
    payload.preferred_username,
    payload.upn,
    payload.unique_name,
    payload.username,
    payload.name,
  ];
  
  for (const candidate of emailCandidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      // If it looks like an email, use it
      if (candidate.includes('@')) {
        return candidate;
      }
      // If it's not a UUID, it's probably a username - use it
      if (!isUUID(candidate)) {
        return candidate;
      }
    }
  }
  
  // Fall back to user ID, but if it's a UUID, try to make it more friendly
  if (userId) {
    if (isUUID(userId)) {
      // Just use 'User' as a friendly fallback when we only have UUIDs
      return 'User';
    }
    return userId;
  }
  
  return 'Unknown User';
}

/**
 * GET /api/session
 *
 * Lightweight session endpoint for UI chrome (navbar/user dropdown).
 * Derives user identity from:
 * 1. app-session cookie (set by SSO flow)
 * 2. JWT token (cookie or Authorization header)
 * 3. TEST_USER env vars (local dev fallback)
 */
export async function GET(request: NextRequest) {
  try {
    // First check for app-session cookie (set by SSO flow)
    const ssoSession = getSessionFromRequest(request);
    if (ssoSession) {
      // Get a display-friendly email
      const displayEmail = ssoSession.email && ssoSession.email.length > 0 && !isUUID(ssoSession.email)
        ? ssoSession.email
        : 'User';
      
      return NextResponse.json({
        user: {
          id: ssoSession.userId,
          email: displayEmail,
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
    const userId = getUserIdFromToken(token) || 
      (typeof payload.sub === 'string' ? payload.sub : null) || 
      (typeof payload.user_id === 'string' ? payload.user_id : null) || 
      (typeof payload.userId === 'string' ? payload.userId : null);

    // Get a display-friendly email
    const email = extractEmail(payload, userId);

    return NextResponse.json({
      user: userId
        ? {
            id: String(userId),
            email,
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
  } catch (error) {
    console.error("[SESSION] Error:", error);
    return NextResponse.json({
      user: null,
      isAuthenticated: false,
      error: "Failed to get session",
    });
  }
}
