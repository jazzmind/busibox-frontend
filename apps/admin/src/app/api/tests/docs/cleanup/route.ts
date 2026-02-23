import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';
import { buildServiceAuthorization } from '../../helpers';

/**
 * POST /api/tests/docs/cleanup
 * 
 * Delete all test documents and clear state to force fresh re-upload.
 * Useful for testing data pipeline changes.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;

    // Set session JWT for Zero Trust token exchange
    setSessionJwtForUser(user.id, sessionJwt);

    // Build authorization header (legacy - dataFetch now handles this internally)
    const authorization = await buildServiceAuthorization(sessionJwt, user);

    // Call data-api cleanup endpoint
    const response = await dataFetch(
      'Cleanup test docs',
      '/test-docs/cleanup',
      {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'X-User-Id': user.id,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: data.message || 'Test documents cleaned up',
      deleted: data.deleted || [],
      errors: data.errors || [],
    });
  } catch (error: any) {
    console.error('[admin/tests/docs/cleanup] Failed to cleanup test docs', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to cleanup test documents',
      },
      { status: 500 }
    );
  }
}










