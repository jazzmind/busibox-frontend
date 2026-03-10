/**
 * GET /api/auth/callback/microsoft
 * 
 * Handles the Microsoft Entra ID OIDC callback after user authorization.
 * 
 * Flow:
 * 1. Validates the state parameter (CSRF protection)
 * 2. Exchanges the authorization code for tokens with Microsoft
 * 3. Decodes the ID token to get user claims
 * 4. Calls authz POST /auth/idp/authenticate to upsert user and create session
 * 5. Sets the busibox-session cookie and redirects to home
 */

import { NextRequest, NextResponse } from 'next/server';

const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

function getCallbackUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  return `${appUrl}/api/auth/callback/microsoft`;
}

function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
}

function getHomeUrl(): string {
  return `${getAppBaseUrl()}/`;
}

function getLoginUrl(error: string): string {
  return `${getAppBaseUrl()}/login?error=${encodeURIComponent(error)}`;
}

/**
 * Decode a JWT payload without verification.
 * We trust the token because we just received it directly from Microsoft's token endpoint over HTTPS.
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
  return JSON.parse(payload);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle errors from Microsoft
    if (error) {
      console.error('[Microsoft Callback] Microsoft returned error:', error, errorDescription);
      return NextResponse.redirect(getLoginUrl(`microsoft_${error}`));
    }

    if (!code || !state) {
      console.error('[Microsoft Callback] Missing code or state parameter');
      return NextResponse.redirect(getLoginUrl('missing_params'));
    }

    // Verify CSRF state
    const storedState = request.cookies.get('microsoft-oauth-state')?.value;
    if (!storedState || storedState !== state) {
      console.error('[Microsoft Callback] State mismatch - possible CSRF attack');
      return NextResponse.redirect(getLoginUrl('state_mismatch'));
    }

    // Fetch Microsoft IdP config from authz including the client_secret.
    // The secret lives in authz's DB (or env), not in the portal's env.
    const configRes = await fetch(`${AUTHZ_BASE_URL}/auth/idp/microsoft/token-config`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!configRes.ok) {
      console.error('[Microsoft Callback] Failed to get Microsoft token config from authz:', configRes.status);
      return NextResponse.redirect(getLoginUrl('config_error'));
    }

    const msConfig = await configRes.json();
    const { client_id, client_secret: clientSecret, token_endpoint } = msConfig;

    if (!clientSecret) {
      console.error('[Microsoft Callback] No client_secret in authz Microsoft config');
      return NextResponse.redirect(getLoginUrl('config_error'));
    }

    // Exchange authorization code for tokens with Microsoft
    const tokenParams = new URLSearchParams({
      client_id,
      client_secret: clientSecret,
      code,
      redirect_uri: getCallbackUrl(),
      grant_type: 'authorization_code',
      scope: 'openid profile email User.Read',
    });

    const tokenRes = await fetch(token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const tokenError = await tokenRes.text();
      console.error('[Microsoft Callback] Token exchange failed:', tokenRes.status, tokenError);
      return NextResponse.redirect(getLoginUrl('token_exchange_failed'));
    }

    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;

    if (!idToken) {
      console.error('[Microsoft Callback] No id_token in token response');
      return NextResponse.redirect(getLoginUrl('no_id_token'));
    }

    // Decode the ID token to get user claims
    const claims = decodeJwtPayload(idToken);

    const email = (claims.email || claims.preferred_username || claims.upn) as string | undefined;
    if (!email) {
      console.error('[Microsoft Callback] No email in ID token claims:', Object.keys(claims));
      return NextResponse.redirect(getLoginUrl('no_email'));
    }

    // Extract user info from claims
    const displayName = claims.name as string | undefined;
    const firstName = claims.given_name as string | undefined;
    const lastName = claims.family_name as string | undefined;
    const oid = claims.oid as string | undefined; // Azure AD Object ID
    const tid = claims.tid as string | undefined; // Tenant ID
    const roles = (claims.roles || []) as string[];
    const groups = (claims.groups || []) as string[];

    // Call authz to authenticate/upsert user with IdP claims
    const authzRes = await fetch(`${AUTHZ_BASE_URL}/auth/idp/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        idp_provider: 'microsoft',
        idp_tenant_id: tid,
        idp_object_id: oid,
        idp_roles: roles,
        idp_groups: groups,
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
      }),
    });

    if (!authzRes.ok) {
      const authzError = await authzRes.text();
      console.error('[Microsoft Callback] Authz IdP authenticate failed:', authzRes.status, authzError);

      if (authzRes.status === 403) {
        return NextResponse.redirect(getLoginUrl('domain_not_allowed'));
      }
      return NextResponse.redirect(getLoginUrl('auth_failed'));
    }

    const authResult = await authzRes.json();
    const { session } = authResult;

    // Set session cookie and redirect to home
    const response = NextResponse.redirect(getHomeUrl());

    const expiresAt = new Date(session.expires_at);
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    response.cookies.set('busibox-session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: maxAge > 0 ? maxAge : 60 * 60 * 24,
      path: '/',
    });

    // Clear the CSRF state cookie
    response.cookies.delete('microsoft-oauth-state');

    return response;
  } catch (error) {
    console.error('[Microsoft Callback] Unexpected error:', error);
    return NextResponse.redirect(getLoginUrl('unexpected_error'));
  }
}
