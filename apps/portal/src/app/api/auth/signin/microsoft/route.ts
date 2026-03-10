/**
 * GET /api/auth/signin/microsoft
 * 
 * Initiates the Microsoft Entra ID (Azure AD) OIDC authorization code flow.
 * 
 * 1. Fetches Microsoft IdP config from authz service (client_id, tenant_id)
 * 2. Generates a random state parameter for CSRF protection
 * 3. Redirects the user to Microsoft's authorization endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

function getCallbackUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  return `${appUrl}/api/auth/callback/microsoft`;
}

export async function GET(request: NextRequest) {
  try {
    // Fetch Microsoft IdP config from authz
    const configRes = await fetch(`${AUTHZ_BASE_URL}/auth/idp/microsoft/config`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!configRes.ok) {
      console.error('[Microsoft Sign-In] Microsoft auth not configured in authz:', configRes.status);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'microsoft_not_configured');
      return NextResponse.redirect(loginUrl);
    }

    const msConfig = await configRes.json();
    const { client_id, authorization_endpoint } = msConfig;

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in a short-lived cookie for verification on callback
    const redirectUrl = new URL(authorization_endpoint);
    redirectUrl.searchParams.set('client_id', client_id);
    redirectUrl.searchParams.set('response_type', 'code');
    redirectUrl.searchParams.set('redirect_uri', getCallbackUrl());
    redirectUrl.searchParams.set('scope', 'openid profile email User.Read');
    redirectUrl.searchParams.set('state', state);
    redirectUrl.searchParams.set('response_mode', 'query');
    redirectUrl.searchParams.set('prompt', 'select_account');

    const response = NextResponse.redirect(redirectUrl);

    // Set state cookie for CSRF verification (5 min TTL)
    response.cookies.set('microsoft-oauth-state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Microsoft Sign-In] Error initiating Microsoft auth:', error);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'microsoft_error');
    return NextResponse.redirect(loginUrl);
  }
}
