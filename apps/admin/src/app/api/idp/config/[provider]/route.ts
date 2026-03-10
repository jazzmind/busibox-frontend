/**
 * GET/PUT/DELETE /api/idp/config/[provider]
 * 
 * Manage a specific IdP configuration via authz service.
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

interface RouteParams {
  params: Promise<{ provider: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { provider } = await params;
    const token = await getAuthzToken(auth.sessionJwt);

    const res = await fetch(`${AUTHZ_BASE_URL}/admin/idp/config/${provider}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (res.status === 404) {
      return NextResponse.json({ provider, enabled: false, client_id: '', tenant_id: '', has_client_secret: false, metadata: {} });
    }

    if (!res.ok) {
      const text = await res.text();
      console.error('[IdP Config] GET error from authz:', res.status, text);
      return apiError(`Failed to fetch IdP config: ${text}`, res.status);
    }

    return NextResponse.json(await res.json());
  } catch (error) {
    console.error('[IdP Config] GET error:', error);
    return apiError('Failed to fetch IdP configuration', 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { provider } = await params;
    const token = await getAuthzToken(auth.sessionJwt);
    const body = await request.json();

    const res = await fetch(`${AUTHZ_BASE_URL}/admin/idp/config/${provider}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[IdP Config] PUT error from authz:', res.status, text);
      let detail = 'Failed to save IdP configuration';
      try {
        const errJson = JSON.parse(text);
        detail = errJson.detail || errJson.message || detail;
      } catch { /* use default */ }
      return apiError(detail, res.status);
    }

    return NextResponse.json(await res.json());
  } catch (error) {
    console.error('[IdP Config] PUT error:', error);
    return apiError('Failed to save IdP configuration', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { provider } = await params;
    const token = await getAuthzToken(auth.sessionJwt);

    const res = await fetch(`${AUTHZ_BASE_URL}/admin/idp/config/${provider}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
      return apiError(`Failed to delete IdP config: ${provider}`, res.status);
    }

    return NextResponse.json(await res.json());
  } catch (error) {
    console.error('[IdP Config] DELETE error:', error);
    return apiError('Failed to delete IdP configuration', 500);
  }
}
