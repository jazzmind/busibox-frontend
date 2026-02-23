/**
 * User Search API Route
 * 
 * GET /api/users/search?q={query}
 * Search for users by email who have access to apps.
 * 
 * Returns users who:
 * - Are ACTIVE (not PENDING or DEACTIVATED)
 * - Have at least one role with permission to access any app
 * - Match the search query (email contains query)
 * 
 * NOTE: User data is now fetched from authz service.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { listUsers } from '@jazzmind/busibox-app/lib/authz/user-management';
import { listRoleBindings, listRoles, type Role } from '@jazzmind/busibox-app';
import { getAuthzOptions } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getAppByNameFromStore, getAppConfigStoreContextForUser } from '@jazzmind/busibox-app/lib/deploy/app-config';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user: currentUser, sessionJwt } = authResult;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query || query.length < 2) {
      return apiSuccess({
        users: [],
      });
    }

    // Get all active users from authz that match the query
    const authzOptions = getAuthzOptions();
    const usersResponse = await listUsers({
      limit: 100, // Get more users to filter client-side
      status: 'ACTIVE',
    });

    // Filter users by email query (case-insensitive)
    const matchingUsers = usersResponse.users.filter(user => 
      user.email.toLowerCase().includes(query.toLowerCase())
    );

    // Get roles from authz
    const roles = await listRoles(authzOptions);
    const roleMap = new Map(roles.map((r: Role) => [r.id, r]));
    
    // Find the Admin role
    const adminRole = roles.find((r: Role) => r.name === 'Admin');
    
    // Find the Media Generator app
    const storeContext = await getAppConfigStoreContextForUser(currentUser.id, sessionJwt);
    const mediaGenApp = await getAppByNameFromStore(storeContext.accessToken, 'Media Generator');

    // Get role bindings for the Media Generator app
    let videoGenRoleIds: Set<string> = new Set();
    if (mediaGenApp?.isActive) {
      const bindings = await listRoleBindings({
        resource_type: 'app',
        resource_id: mediaGenApp.id,
      }, authzOptions as any);
      videoGenRoleIds = new Set(bindings.map((b: { role_id: string }) => b.role_id));
    }

    // Filter users who are admins OR have access to Media Generator app
    const filteredUsers = matchingUsers.filter(user => {
      const userRoles = user.roles || [];
      
      // Check if user is admin
      if (adminRole && userRoles.some(r => r.id === adminRole.id)) {
        return true;
      }
      
      // Check if user has a role with Media Generator access
      return userRoles.some(r => videoGenRoleIds.has(r.id));
    });

    // Format response with role names (limit to 20 results)
    const formattedUsers = filteredUsers.slice(0, 20).map(user => {
      const userRoles = user.roles || [];
      return {
        id: user.id,
        email: user.email,
        roles: userRoles.map(r => r.name),
        isAdmin: adminRole ? userRoles.some(r => r.id === adminRole.id) : false,
      };
    });

    return apiSuccess({
      users: formattedUsers,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[USER SEARCH] Error searching users:', err);
    return apiError(err?.message || 'Failed to search users', 500);
  }
}
