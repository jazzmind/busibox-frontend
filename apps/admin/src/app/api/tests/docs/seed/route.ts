import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { buildServiceAuthorization } from '../../helpers';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user, sessionJwt } = authResult;
  
  // Set session JWT for Zero Trust token exchange
  setSessionJwtForUser(user.id, sessionJwt);
  
  const authHeader = await buildServiceAuthorization(sessionJwt, user);
  const body = await request.json().catch(() => ({}));

  try {
    const response = await dataFetch(
      'Seed test docs',
      '/test-docs/seed',
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'X-User-Id': user.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          force: Boolean(body?.force),
        }),
      }
    );

    const data = await response.json();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('[admin/tests/docs/seed] Failed to seed test docs', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to seed test docs' },
      { status: 500 }
    );
  }
}










