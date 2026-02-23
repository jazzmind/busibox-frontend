/**
 * Library Purge API Route
 *
 * DELETE: Permanently delete a soft-deleted library (admin only)
 *
 * Note: data-api get_library filters out soft-deleted libraries, so we cannot
 * verify the library exists before purge. Admin-only ensures only authorized
 * users can purge. The data-api DELETE with hard_delete=true will permanently
 * remove the library record.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id } = await params;
    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:write'],
      purpose: 'library-operations',
    });

    const deleteResponse = await fetch(`${getDataApiUrl()}/libraries/${id}?hard_delete=true`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('[API] Data-api purge failed:', deleteResponse.status, errorText);
      return apiError('Failed to purge library', 500);
    }

    return apiSuccess({ message: 'Library permanently deleted' });
  } catch (error: unknown) {
    console.error('[API] Purge library error:', error);
    return apiError(error instanceof Error ? error.message : 'An unexpected error occurred', 500);
  }
}
