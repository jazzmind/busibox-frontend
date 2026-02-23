/**
 * Document Tags API Route
 *
 * PATCH: Update extracted keywords/tags for a document
 *
 * Proxies to data-api PATCH /files/{fileId} with extractedKeywords.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ fileId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { fileId } = await params;
    const body = await request.json();
    const { extractedKeywords } = body || {};

    if (!Array.isArray(extractedKeywords)) {
      return apiError('extractedKeywords must be an array of strings', 400);
    }

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:write'],
      purpose: 'document-tags-update',
    });

    const dataApiUrl = getDataApiUrl();
    const response = await fetch(`${dataApiUrl}/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
      body: JSON.stringify({ extractedKeywords }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return apiError('Document not found', 404);
      }
      if (response.status === 403) {
        return apiError('Access denied', 403);
      }
      const errorText = await response.text();
      console.error('[API] PATCH document tags failed:', response.status, errorText);
      return apiError('Failed to update tags', 500);
    }

    return apiSuccess({ fileId, ok: true });
  } catch (error: unknown) {
    console.error('[API] Document tags update error:', error);
    return apiError(error instanceof Error ? error.message : 'An unexpected error occurred', 500);
  }
}
