/**
 * GET /api/setup/status
 * 
 * Check if initial setup is complete.
 * Returns setupComplete from the busibox-portal config data document via data-api.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDataApiTokenForUser, getPortalConfigFromDataApi } from '@jazzmind/busibox-app/lib/data/portal-config';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user, sessionJwt } = authResult;
    const tokenResult = await getDataApiTokenForUser(user.id, sessionJwt);
    const config = await getPortalConfigFromDataApi(tokenResult.accessToken);

    return apiSuccess({
      setupComplete: config.setupComplete === true,
      setupCompletedAt: config.setupCompletedAt,
    });
  } catch (error) {
    console.error('[API] Get setup status error:', error);
    return apiSuccess({
      setupComplete: false,
      setupCompletedAt: null,
      degraded: true,
    });
  }
}
