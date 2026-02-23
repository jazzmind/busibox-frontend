/**
 * Admin User Roles API
 * 
 * POST /api/users/[userId]/roles - Assign role to user
 * DELETE /api/users/[userId]/roles - Remove role from user
 * 
 * All user-role management is handled by the authz service.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody, validateRequiredFields } from '@jazzmind/busibox-app/lib/next/middleware';
import { logRoleAssigned, logRoleRemoved } from '@jazzmind/busibox-app/lib/authz/audit';
import { getUser, addUserRole, removeUserRole, getAuthzAccessToken, type AuthzUser } from '@jazzmind/busibox-app/lib/authz/user-management';
import { getRole, type Role } from '@jazzmind/busibox-app';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';

type RouteParams = {
  params: Promise<{ userId: string }>;
};

// POST /api/users/[userId]/roles - Assign role
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const { userId } = await params;
    const body = await parseJsonBody(request);

    // Validate request
    const validationError = validateRequiredFields(body, ['roleId']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { roleId } = body;

    // Exchange session JWT for authz access token
    const accessToken = await getAuthzAccessToken(sessionJwt);

    // Get options with token for busibox-app functions
    const options = await getAuthzOptionsWithToken(sessionJwt);

    // Check user exists
    const user = await getUser(userId, accessToken);
    if (!user) {
      return apiError('User not found', 404);
    }

    // Check role exists
    const role = await getRole(roleId, options);
    if (!role) {
      return apiError('Role not found', 404);
    }

    // Check if already assigned
    // user.roles is an array of Role objects from authz
    const userRoles = (user.roles || []) as unknown as Role[];
    if (userRoles.some(r => r.id === roleId)) {
      return apiError('Role already assigned to user', 409);
    }

    // Assign role via authz with access token
    await addUserRole(userId, roleId, accessToken);

    // Log role assignment
    await logRoleAssigned(userId, roleId, role.name, adminUser.id);

    return apiSuccess({
      message: 'Role assigned successfully',
    }, 201);
  } catch (error) {
    console.error('[API] Admin assign role error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// DELETE /api/users/[userId]/roles - Remove role
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const { userId } = await params;
    const body = await parseJsonBody(request);

    // Validate request
    const validationError = validateRequiredFields(body, ['roleId']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { roleId } = body;

    // Exchange session JWT for authz access token
    const accessToken = await getAuthzAccessToken(sessionJwt);

    // Check user exists and has the role
    const user = await getUser(userId, accessToken);
    if (!user) {
      return apiError('User not found', 404);
    }

    // user.roles is an array of Role objects from authz
    const userRolesDelete = (user.roles || []) as unknown as Role[];
    const assignedRole = userRolesDelete.find(r => r.id === roleId);
    if (!assignedRole) {
      return apiError('Role assignment not found', 404);
    }

    // Remove role via authz with access token
    await removeUserRole(userId, roleId, accessToken);

    // Log role removal
    await logRoleRemoved(userId, roleId, assignedRole.name, adminUser.id);

    return apiSuccess({
      message: 'Role removed successfully',
    });
  } catch (error) {
    console.error('[API] Admin remove role error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
