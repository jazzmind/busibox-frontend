/**
 * POST /api/apps/reorder
 * 
 * Reorder applications by updating their displayOrder values.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiSuccess, apiError, parseJsonBody, validateRequiredFields } from '@jazzmind/busibox-app/lib/next/middleware';
import { logEvent } from '@jazzmind/busibox-app/lib/authz/audit';
import { reorderAppConfigs } from '@jazzmind/busibox-app/lib/deploy/app-config';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;

    // Verify admin role
    if (!user.roles?.includes('Admin')) {
      return apiError('Insufficient permissions', 403);
    }

    const body = await parseJsonBody(request);
    const validationError = validateRequiredFields(body, ['apps']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { apps } = body;

    if (!Array.isArray(apps) || apps.length === 0) {
      return apiError('Apps must be a non-empty array', 400);
    }

    // Validate each app update
    for (const app of apps) {
      if (!app.id || typeof app.displayOrder !== 'number') {
        return apiError('Each app must have id and displayOrder', 400);
      }
    }

    await reorderAppConfigs(
      { userId: user.id, sessionJwt: authResult.sessionJwt },
      apps.map((app) => ({ id: app.id, displayOrder: app.displayOrder }))
    );

    // Log audit event
    await logEvent({
      eventType: 'APP_UPDATED',
      userId: user.id,
      action: `Reordered ${apps.length} applications`,
      details: {
        appCount: apps.length,
        updates: apps.map(a => ({ id: a.id, displayOrder: a.displayOrder })),
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      success: true,
    });

    return apiSuccess({
      message: 'Apps reordered successfully',
      count: apps.length,
    });
  } catch (error: any) {
    console.error('[API] App reorder error:', error);
    
    // Log failed audit event
    const authResult = await requireAuth(request);
    if (!(authResult instanceof Response)) {
      await logEvent({
        eventType: 'APP_UPDATED',
        userId: authResult.user.id,
        action: 'Failed to reorder applications',
        errorMessage: error.message,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        success: false,
      });
    }

    return apiError('An unexpected error occurred', 500);
  }
}

