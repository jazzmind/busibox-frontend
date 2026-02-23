import { NextResponse, NextRequest } from 'next/server';
import { requireAdminAuth, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { decodeJwt } from 'jose';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  // Get session JWT for Zero Trust exchange
  const sessionJwt = getSessionJwt(request);
  if (!sessionJwt) {
    return NextResponse.json({ error: 'Missing session JWT' }, { status: 401 });
  }

  // Use Zero Trust token exchange (no client credentials needed)
  const exchanged = await exchangeWithSubjectToken({
    sessionJwt,
    userId: user.id,
    audience: 'data-api',
    scopes: [],
    purpose: 'busibox-portal.admin-test',
  });
  const token = exchanged.accessToken;

  const decoded = decodeJwt(token);

  return NextResponse.json({
    success: true,
    data: {
      token,
      decoded,
    },
  });
}





