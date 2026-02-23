/**
 * Admin Role Permissions API
 * 
 * POST /api/roles/[roleId]/permissions - Grant app permission to role
 * DELETE /api/roles/[roleId]/permissions - Revoke app permission from role
 * 
 * All role-app bindings are stored in the authz service.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody, validateRequiredFields } from '@jazzmind/busibox-app/lib/next/middleware';
import { logPermissionGranted, logPermissionRevoked } from '@jazzmind/busibox-app/lib/authz/audit';
import {
  getRole,
  grantRoleResourceAccess,
  revokeRoleResourceAccess,
  listRoleBindings,
} from '@jazzmind/busibox-app';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getAppByIdFromStore, getAppConfigStoreContextForUser } from '@jazzmind/busibox-app/lib/deploy/app-config';

type RouteParams = {
  params: Promise<{ roleId: string }>;
};

// POST /api/roles/[roleId]/permissions - Grant permission
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const { roleId } = await params;
    const body = await parseJsonBody(request);

    // Validate request
    const validationError = validateRequiredFields(body, ['appId']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { appId } = body;

    // Get options with exchanged token
    const options = await getAuthzOptionsWithToken(sessionJwt);

    // Check role exists in authz
    const role = await getRole(roleId, options);
    if (!role) {
      return apiError('Role not found', 404);
    }

    // Check app exists and is active in local db
    const appStoreContext = await getAppConfigStoreContextForUser(adminUser.id, sessionJwt);
    const app = await getAppByIdFromStore(appStoreContext.accessToken, appId);

    if (!app) {
      return apiError('App not found', 404);
    }

    if (!app.isActive) {
      return apiError('Cannot grant permission to inactive app', 400);
    }

    // Check if binding already exists
    const existingBindings = await listRoleBindings(
      { role_id: roleId, resource_type: 'app', resource_id: appId },
      options
    );

    if (existingBindings.length > 0) {
      return apiError('Permission already granted', 409);
    }

    // Create binding in authz
    await grantRoleResourceAccess(roleId, 'app', appId, undefined, options);

    // Log permission grant
    await logPermissionGranted(roleId, role.name, appId, app.name, adminUser.id);

    return apiSuccess({
      message: 'Permission granted successfully',
    }, 201);
  } catch (error) {
    console.error('[API] Admin grant permission error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// DELETE /api/roles/[roleId]/permissions - Revoke permission
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const { roleId } = await params;
    const body = await parseJsonBody(request);

    // Validate request
    const validationError = validateRequiredFields(body, ['appId']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { appId } = body;

    // Get options with exchanged token
    const options = await getAuthzOptionsWithToken(sessionJwt);

    // Check role exists in authz
    const role = await getRole(roleId, options);
    if (!role) {
      return apiError('Role not found', 404);
    }

    // Check app exists in local db
    const appStoreContext = await getAppConfigStoreContextForUser(adminUser.id, sessionJwt);
    const app = await getAppByIdFromStore(appStoreContext.accessToken, appId);

    if (!app) {
      return apiError('App not found', 404);
    }

    // Revoke binding in authz
    const revoked = await revokeRoleResourceAccess(roleId, 'app', appId, options);

    if (!revoked) {
      return apiError('Permission not found', 404);
    }

    // Log permission revocation
    await logPermissionRevoked(roleId, role.name, appId, app.name, adminUser.id);

    return apiSuccess({
      message: 'Permission revoked successfully',
    });
  } catch (error) {
    console.error('[API] Admin revoke permission error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
