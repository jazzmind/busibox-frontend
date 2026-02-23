/**
 * Library Documents API Route
 * 
 * GET: List documents in a library with optional filtering
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { canAccessLibrary, getLibraryDocuments } from '@jazzmind/busibox-app/lib/data/libraries';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id } = await params;

    const hasAccess = await canAccessLibrary(user.id, id, sessionJwt);
    if (!hasAccess) {
      return apiError('Library not found or access denied', 404);
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const sortBy = (searchParams.get('sortBy') || 'createdAt') as 'name' | 'createdAt' | 'size';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const status = searchParams.get('status') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam
      ? tagsParam.split(',').map(t => t.trim()).filter(Boolean)
      : undefined;
    const search = searchParams.get('search') || undefined;

    // Fetch documents from data-api with Zero Trust token exchange
    const documents = await getLibraryDocuments(id, {
      sortBy,
      sortOrder,
      status,
      tag,
      tags,
      search,
      // Zero Trust: Pass auth context for data-api token exchange
      sessionJwt,
      userId: user.id,
    });

    return apiSuccess({ documents });
  } catch (error: any) {
    console.error('[API] List library documents error:', error);
    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}

