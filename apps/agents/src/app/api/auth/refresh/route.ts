/**
 * POST /api/auth/refresh
 * 
 * Refresh the authentication tokens for busibox-agents.
 * 
 * This endpoint:
 * 1. Takes the current SSO token from cookies (if available)
 * 2. Exchanges it for a fresh authz token from the authz service
 * 3. Returns the new token for client use
 * 
 * If the SSO token is expired, clients should redirect back to portal
 * to get a new SSO token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokenFromRequest, isTokenExpired, parseJWTPayload } from '@jazzmind/busibox-app/lib/authz/auth-helper';
import { getApiToken } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function POST(request: NextRequest) {
  try {
    const ssoToken = getTokenFromRequest(request);
    
    // Check for test user mode (local development)
    if (!ssoToken) {
      const testUserId = process.env.TEST_USER_ID;
      const testUserEmail = process.env.TEST_USER_EMAIL;
      
      if (testUserId && testUserEmail) {
        console.log('[AUTH/REFRESH] No SSO token, using test user credentials');
        
        const testSessionJwt = process.env.TEST_SESSION_JWT;
        if (!testSessionJwt) {
          return NextResponse.json(
            { error: 'TEST_SESSION_JWT not configured', requiresReauth: true },
            { status: 401 }
          );
        }
        const apiToken = await getApiToken(testSessionJwt, 'agent-api');
        
        return NextResponse.json({
          success: true,
          token: apiToken,
          isTestUser: true,
        });
      }
      
      return NextResponse.json(
        { 
          error: 'No token to refresh',
          message: 'Please return to the Busibox Portal and log in again.',
          requiresReauth: true,
        },
        { status: 401 }
      );
    }

    // Check if SSO token is expired
    if (isTokenExpired(ssoToken)) {
      console.log('[AUTH/REFRESH] SSO token is expired, user needs to re-authenticate');
      
      return NextResponse.json(
        { 
          error: 'SSO token expired',
          message: 'Your session has expired. Please return to the Busibox Portal and log in again.',
          requiresReauth: true,
        },
        { status: 401 }
      );
    }

    // Exchange SSO token for fresh authz token
    // Log token details for debugging
    const tokenPayload = parseJWTPayload(ssoToken);
    console.log('[AUTH/REFRESH] Exchanging SSO token for fresh authz token', {
      typ: tokenPayload?.typ,
      aud: tokenPayload?.aud,
      app_id: tokenPayload?.app_id,
      sub: tokenPayload?.sub,
    });
    const apiToken = await getApiToken(ssoToken, 'agent-api');
    
    // Update the auth_token cookie with the new authz token
    const cookieStore = await cookies();
    cookieStore.set('agent_api_token', apiToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15, // 15 minutes (authz tokens are short-lived)
    });

    return NextResponse.json({
      success: true,
      token: apiToken,
      expiresIn: 900, // 15 minutes
    });
  } catch (error: any) {
    console.error('[AUTH/REFRESH] Token refresh failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for specific error types
    if (errorMessage.includes('Invalid SSO token') || errorMessage.includes('expired')) {
      return NextResponse.json(
        { 
          error: 'Token refresh failed',
          message: 'Your session is invalid. Please return to the Busibox Portal and log in again.',
          requiresReauth: true,
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Token refresh failed',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
