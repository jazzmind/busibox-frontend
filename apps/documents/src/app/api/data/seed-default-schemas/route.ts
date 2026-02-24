/**
 * Seed Default Extraction Schemas API Route
 *
 * POST: Create built-in extraction schemas if they don't already exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user, sessionJwt } = authResult;
    const result = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data.write'],
      purpose: 'seed-default-schemas',
    });

    const dataApiUrl = getDataApiUrl();
    const response = await fetch(`${dataApiUrl}/data/seed-default-schemas`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${result.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const bodyText = await response.text();
    return new NextResponse(bodyText, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
    });
  } catch (error: any) {
    return apiError(error.message || 'Failed to seed default schemas', 500);
  }
}
