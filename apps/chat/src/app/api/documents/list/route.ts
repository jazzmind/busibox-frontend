/**
 * Document List API Route
 *
 * Returns list of documents for the current user from data-api.
 * Aggregates documents from all libraries accessible to the user.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { getUserLibraries } from '@jazzmind/busibox-app/lib/data/libraries';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status');

    const libraries = await getUserLibraries(user.id, sessionJwt);
    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:read'],
      purpose: 'document-list',
    });

    const dataApiUrl = getDataApiUrl();
    const allDocuments: unknown[] = [];

    for (const lib of libraries) {
      const libId = typeof lib === 'object' && lib !== null && 'id' in lib ? (lib as { id: string }).id : '';
      if (!libId) continue;

      const params = new URLSearchParams();
      params.append('sortBy', 'createdAt');
      params.append('sortOrder', 'desc');
      if (status) params.append('status', status);

      const docResponse = await fetch(
        `${dataApiUrl}/libraries/${libId}/documents?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${tokenResult.accessToken}`,
          },
        }
      );

      if (docResponse.ok) {
        const data = await docResponse.json();
        const docs = data.documents || data.data || [];
        for (const doc of docs) {
          allDocuments.push({ ...doc, libraryId: libId });
        }
      }
    }

    // Sort by createdAt desc (most recent first)
    allDocuments.sort((a: unknown, b: unknown) => {
      const aDate = (a as { createdAt?: string }).createdAt || '';
      const bDate = (b as { createdAt?: string }).createdAt || '';
      return bDate.localeCompare(aDate);
    });

    const total = allDocuments.length;
    const documents = allDocuments.slice(offset, offset + limit);

    return apiSuccess({
      documents,
      total,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error('[API] Document list error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
