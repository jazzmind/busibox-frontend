/**
 * GET /api/dashboard/profile
 * 
 * Get current user's profile information.
 * 
 * User roles are embedded directly in the session JWT (set during login).
 * No additional API calls are needed.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    // If not authenticated, requireAuth returns error response
    if (authResult instanceof Response) {
      return authResult;
    }

    // User roles are now embedded in the session JWT
    const { user } = authResult;

    return apiSuccess({
      profile: {
        id: user.id,
        email: user.email,
        status: user.status,
        roles: user.roles || [],
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        favoriteColor: user.favoriteColor,
      },
    });
  } catch (error) {
    console.error('[API] Dashboard profile error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

