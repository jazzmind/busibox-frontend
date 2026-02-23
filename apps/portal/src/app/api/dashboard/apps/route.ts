/**
 * GET /api/dashboard/apps
 * 
 * Get all apps the current user has permission to access.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getUserApps } from '@jazzmind/busibox-app/lib/deploy/app-permissions';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    // If not authenticated, requireAuth returns error response
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;

    // Get apps the user has permission to access
    // Pass sessionJwt for authenticated RBAC calls
    const apps = await getUserApps(user.id, sessionJwt);

    return apiSuccess({
      apps,
    });
  } catch (error) {
    console.error('[API] Dashboard apps error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

