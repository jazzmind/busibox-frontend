/**
 * Library Tags API Route
 * 
 * GET: Get tag groups for a library
 * POST: Refresh tag cache
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { setSessionJwtForUser } from '@jazzmind/busibox-app/lib/agent/app-client';
import { canAccessLibrary } from '@jazzmind/busibox-app/lib/data/libraries';
import { getLibraryTagGroups } from '@jazzmind/busibox-app/lib/data/tags';

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

    setSessionJwtForUser(user.id, sessionJwt);

    const tagGroups = await getLibraryTagGroups(id, false, {
      sessionJwt,
      userId: user.id,
    });

    return apiSuccess({ tagGroups });
  } catch (error: any) {
    console.error('[API] Get library tags error:', error);
    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    setSessionJwtForUser(user.id, sessionJwt);

    // Force refresh
    const tagGroups = await getLibraryTagGroups(id, true, {
      sessionJwt,
      userId: user.id,
    });

    return apiSuccess({ tagGroups });
  } catch (error: any) {
    console.error('[API] Refresh library tags error:', error);
    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}

