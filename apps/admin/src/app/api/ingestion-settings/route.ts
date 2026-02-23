/**
 * Admin API for Data Settings
 * 
 * Allows administrators to configure document data processing options.
 * Backed by data-api document storage (replaces Prisma DataSettings model).
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getDataApiTokenForSettings,
  getDataSettings,
  updateDataSettings,
} from '@jazzmind/busibox-app/lib/data/settings';

/**
 * GET /api/data-settings
 * 
 * Retrieve current data settings.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;

    // Verify user is admin
    if (!user.roles?.includes('Admin')) {
      return apiError('Unauthorized - Admin role required', 403);
    }

    const { accessToken } = await getDataApiTokenForSettings(user.id, sessionJwt);
    const settings = await getDataSettings(accessToken);

    return apiSuccess(settings);
  } catch (error: any) {
    console.error('[API] Error fetching data settings:', error);
    return apiError(error.message || 'Failed to fetch data settings', 500);
  }
}

/**
 * PATCH /api/data-settings
 * 
 * Update data settings.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;

    // Verify user is admin
    if (!user.roles?.includes('Admin')) {
      return apiError('Unauthorized - Admin role required', 403);
    }

    const body = await parseJsonBody(request);

    // Validate numeric ranges
    if (body.maxParallelStrategies !== undefined) {
      if (body.maxParallelStrategies < 1 || body.maxParallelStrategies > 3) {
        return apiError('maxParallelStrategies must be between 1 and 3', 400);
      }
    }

    if (body.chunkSizeMin !== undefined) {
      if (body.chunkSizeMin < 100 || body.chunkSizeMin > 1000) {
        return apiError('chunkSizeMin must be between 100 and 1000', 400);
      }
    }

    if (body.chunkSizeMax !== undefined) {
      if (body.chunkSizeMax < 200 || body.chunkSizeMax > 2000) {
        return apiError('chunkSizeMax must be between 200 and 2000', 400);
      }
    }

    if (body.chunkOverlapPct !== undefined) {
      if (body.chunkOverlapPct < 0 || body.chunkOverlapPct > 0.5) {
        return apiError('chunkOverlapPct must be between 0 and 0.5', 400);
      }
    }

    const { accessToken, roleIds } = await getDataApiTokenForSettings(user.id, sessionJwt);
    const updatedSettings = await updateDataSettings(accessToken, roleIds, {
      llmCleanupEnabled: body.llmCleanupEnabled,
      multiFlowEnabled: body.multiFlowEnabled,
      maxParallelStrategies: body.maxParallelStrategies,
      markerEnabled: body.markerEnabled,
      colpaliEnabled: body.colpaliEnabled,
      chunkSizeMin: body.chunkSizeMin,
      chunkSizeMax: body.chunkSizeMax,
      chunkOverlapPct: body.chunkOverlapPct,
      timeoutSmall: body.timeoutSmall,
      timeoutMedium: body.timeoutMedium,
      timeoutLarge: body.timeoutLarge,
    });

    console.log(`[API] Data settings updated by ${user.email}`);

    return apiSuccess(updatedSettings);
  } catch (error: any) {
    console.error('[API] Error updating data settings:', error);
    return apiError(error.message || 'Failed to update data settings', 500);
  }
}
