import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { buildServiceAuthorization } from '../../helpers';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

async function fetchStatus(authHeader: string, userId: string) {
  try {
    const response = await dataFetch(
      'Fetch test-doc-service status',
      '/test-docs/status',
      {
        headers: {
          Authorization: authHeader,
          'X-User-Id': userId,
        },
      }
    );
    return await response.json();
  } catch (error: any) {
    return {
      error: error?.message || 'Unable to reach test-doc-service',
    };
  }
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user, sessionJwt } = authResult;
  
  // Set session JWT for Zero Trust token exchange
  setSessionJwtForUser(user.id, sessionJwt);
  
  const authHeader = await buildServiceAuthorization(sessionJwt, user);

  const status = await fetchStatus(authHeader, user.id);

  return NextResponse.json({
    success: !status.error,
    data: status,
    error: status.error,
  });
}










