/**
 * GET /api/idp/config
 * 
 * List all IdP configurations from authz service.
 * Proxied through admin app for auth token exchange.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

async function getAuthzToken(sessionJwt: string): Promise<string> {
  const result = await exchangeTokenZeroTrust(
    { sessionJwt, audience: 'authz-api', purpose: 'idp-config' },
    { authzBaseUrl: AUTHZ_BASE_URL }
  );
  return result.accessToken;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const token = await getAuthzToken(auth.sessionJwt);

    const res = await fetch(`${AUTHZ_BASE_URL}/admin/idp/config`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[IdP Config] Failed to fetch from authz:', res.status, text);
      return apiError('Failed to fetch IdP configuration', res.status);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[IdP Config] Error:', error);
    return apiError('Failed to fetch IdP configuration', 500);
  }
}
