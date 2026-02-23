/**
 * Personal Library Creation API Route
 *
 * POST: Create a new custom personal library (authenticated, non-admin)
 * Sends request to data-api with isPersonal: true, libraryType: 'CUSTOM', and user-provided name.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return apiError('Library name is required', 400);
    }

    if (name.length > 255) {
      return apiError('Library name must be 255 characters or less', 400);
    }

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:read', 'data:write'],
      purpose: 'create-personal-library',
    });

    const dataApiUrl = getDataApiUrl();
    const createResponse = await fetch(`${dataApiUrl}/libraries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
      body: JSON.stringify({
        name,
        isPersonal: true,
        libraryType: 'CUSTOM',
        userId: user.id,
        createdBy: user.id,
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      const errorMessage = errorData?.error || errorData?.details || 'Failed to create library';
      return apiError(errorMessage, createResponse.status);
    }

    const createData = await createResponse.json();
    const library = createData.data || createData;

    return apiSuccess({ library }, 201);
  } catch (error: unknown) {
    console.error('[API] Create personal library error:', error);
    return apiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}
