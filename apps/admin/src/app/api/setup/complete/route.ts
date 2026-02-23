/**
 * POST /api/setup/complete
 * 
 * Mark initial setup as complete.
 * Updates setupComplete in the busibox-portal config data document via data-api.
 * 
 * SECURITY: Requires admin user to have at least one passkey registered.
 * This ensures the admin account is secured before setup is marked complete.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getCurrentUserWithSessionFromCookies, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';
import { listUserPasskeys } from '@jazzmind/busibox-app';
import { getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiTokenForUser, getSharedRoleIdsForConfig, upsertPortalConfigInDataApi } from '@jazzmind/busibox-app/lib/data/portal-config';

export async function POST(request: NextRequest) {
  // Get user with session JWT
  const userWithSession = await getCurrentUserWithSessionFromCookies();
  if (!userWithSession) {
    return apiError('Authentication required', 401);
  }
  
  const { sessionJwt, ...user } = userWithSession;
  
  if (!requireAdmin(user)) {
    return apiError('Admin access required', 403);
  }

  try {
    // SECURITY CHECK: Verify admin has at least one passkey registered
    // This ensures the admin account is properly secured before completing setup
    try {
      const passkeys = await listUserPasskeys(user.id, {
        authzUrl: getAuthzBaseUrl(),
        accessToken: sessionJwt,
      });
      
      if (!passkeys || passkeys.length === 0) {
        console.warn('[API/setup/complete] Admin user has no passkeys registered');
        return apiError('Admin must have at least one passkey registered before completing setup', 403);
      }
      
      console.log(`[API/setup/complete] Admin has ${passkeys.length} passkey(s) registered, proceeding with setup completion`);
    } catch (passkeyError) {
      console.error('[API/setup/complete] Failed to check passkeys:', passkeyError);
      return apiError('Failed to verify passkey registration. Please try again.', 500);
    }

    const tokenResult = await getDataApiTokenForUser(user.id, sessionJwt);
    const roleIds = getSharedRoleIdsForConfig(tokenResult.accessToken, sessionJwt);
    await upsertPortalConfigInDataApi(tokenResult.accessToken, {
      setupComplete: true,
      setupCompletedAt: new Date().toISOString(),
      setupCompletedBy: user.id,
    }, roleIds);

    console.log(`[API/setup/complete] Setup marked complete by user ${user.id}`);

    return apiSuccess({ setupComplete: true });
  } catch (error) {
    console.error('[API] Mark setup complete error:', error);
    return apiError('Failed to mark setup complete', 500);
  }
}
