/**
 * POST /api/auth/refresh
 * 
 * Refresh authentication tokens for busibox-media.
 * Validates the SSO cookie is still valid and optionally exchanges
 * for a fresh downstream API token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, isTokenExpired } from '@jazzmind/busibox-app/lib/authz/auth-helper';

export async function POST(request: NextRequest) {
  try {
    const ssoToken = getTokenFromRequest(request);

    if (!ssoToken) {
      const testUserId = process.env.TEST_USER_ID;
      const testUserEmail = process.env.TEST_USER_EMAIL;

      if (testUserId && testUserEmail) {
        return NextResponse.json({
          success: true,
          isTestUser: true,
          expiresIn: 900,
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

    if (isTokenExpired(ssoToken)) {
      console.log('[AUTH/REFRESH] SSO token is expired');
      return NextResponse.json(
        {
          error: 'SSO token expired',
          message: 'Your session has expired. Please return to the Busibox Portal and log in again.',
          requiresReauth: true,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      expiresIn: 900,
    });
  } catch (error: unknown) {
    console.error('[AUTH/REFRESH] Token refresh failed:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

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
      { error: 'Token refresh failed', message: errorMessage },
      { status: 500 }
    );
  }
}
