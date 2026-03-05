/**
 * GET /api/auth/idp/providers
 * 
 * Proxies the authz IdP providers endpoint to the client.
 * Used by the login page to discover which external IdPs are available.
 */

import { NextResponse } from 'next/server';

const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function GET() {
  try {
    const res = await fetch(`${AUTHZ_BASE_URL}/auth/idp/providers`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ providers: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[IdP Providers] Failed to fetch from authz:', error);
    return NextResponse.json({ providers: [] });
  }
}
