/**
 * Admin Role Detail API
 * 
 * GET /api/roles/[roleId] - Get role details
 * PATCH /api/roles/[roleId] - Update role
 * DELETE /api/roles/[roleId] - Delete role
 * 
 * Role management is handled by the authz service.
 * Role-app bindings are in authz_role_bindings.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import { logRoleUpdated, logRoleDeleted } from '@jazzmind/busibox-app/lib/authz/audit';
import {
  getRole,
  updateRole,
  deleteRole,
  listRoles,
  getRoleResourceBindings,
  listRoleBindings,
} from '@jazzmind/busibox-app';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getAppConfigStoreContextForUser, listAppsFromStore } from '@jazzmind/busibox-app/lib/deploy/app-config';

type RouteParams = {
  params: Promise<{ roleId: string }>;
};

// GET /api/roles/[roleId] - Get role details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const { roleId } = await params;

    // Get options with exchanged token
    const options = await getAuthzOptionsWithToken(sessionJwt);

    // Get role from authz
    const role = await getRole(roleId, options);

    if (!role) {
      return apiError('Role not found', 404);
    }

    // Get app bindings from authz
    const appBindings = await getRoleResourceBindings(roleId, 'app', options);
    
    // Fetch app details for each binding
    const appIds = appBindings.map(b => b.resource_id);
    const appStoreContext = await getAppConfigStoreContextForUser(authResult.user.id, sessionJwt);
    const apps = appIds.length > 0
      ? (await listAppsFromStore(appStoreContext.accessToken))
          .filter((app) => appIds.includes(app.id))
          .map((app) => ({ id: app.id, name: app.name, type: app.type }))
      : [];
    
    const appMap = new Map(apps.map(a => [a.id, a]));

    return apiSuccess({
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.is_system || false,
        scopes: role.scopes || [],
        createdAt: new Date(role.created_at),
        updatedAt: new Date(role.updated_at),
        members: [], // TODO: Fetch from authz if needed
        apps: appBindings
          .map(b => appMap.get(b.resource_id))
          .filter(Boolean)
          .map(app => ({
            appId: app!.id,
            name: app!.name,
            type: app!.type,
          })),
      },
    });
  } catch (error) {
    console.error('[API] Admin get role error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// PATCH /api/roles/[roleId] - Update role
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const { roleId } = await params;
    const body = await parseJsonBody(request);

    // Get options with exchanged token
    const options = await getAuthzOptionsWithToken(sessionJwt);

    // Get existing role from authz
    const existingRole = await getRole(roleId, options);

    if (!existingRole) {
      return apiError('Role not found', 404);
    }

    // Prevent modification of system roles
    if (existingRole.is_system) {
      return apiError('Cannot modify system roles', 403);
    }

    // Validate name if provided
    if (body.name) {
      if (body.name.length < 3 || body.name.length > 50) {
        return apiError('Role name must be between 3 and 50 characters', 400);
      }

      // Check for name conflicts
      if (body.name !== existingRole.name) {
        const allRoles = await listRoles(options);
        const nameConflict = allRoles.find(r => r.name === body.name && r.id !== roleId);
        if (nameConflict) {
          return apiError('A role with this name already exists', 409);
        }
      }
    }

    // Validate scopes if provided
    if (body.scopes !== undefined && !Array.isArray(body.scopes)) {
      return apiError('Scopes must be an array of strings', 400);
    }

    // Update role in authz (including scopes)
    const updatedRole = await updateRole(
      roleId,
      {
        name: body.name,
        description: body.description !== undefined ? body.description : undefined,
        scopes: body.scopes !== undefined ? body.scopes : undefined,
      },
      options
    );

    // Log update
    await logRoleUpdated(roleId, updatedRole.name, adminUser.id);

    return apiSuccess({
      role: {
        id: updatedRole.id,
        name: updatedRole.name,
        description: updatedRole.description,
        isSystem: updatedRole.is_system || false,
        scopes: updatedRole.scopes || [],
        updatedAt: new Date(updatedRole.updated_at),
      },
    });
  } catch (error) {
    console.error('[API] Admin update role error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// DELETE /api/roles/[roleId] - Delete role
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const { roleId } = await params;

    // Get options with exchanged token
    const options = await getAuthzOptionsWithToken(sessionJwt);

    // Get existing role from authz
    const existingRole = await getRole(roleId, options);

    if (!existingRole) {
      return apiError('Role not found', 404);
    }

    // Prevent deletion of system roles
    if (existingRole.is_system) {
      return apiError('Cannot delete system roles', 403);
    }

    // Delete role from authz (cascades to user-role assignments and role bindings)
    await deleteRole(roleId, options);

    // Log deletion
    await logRoleDeleted(roleId, existingRole.name, adminUser.id);

    return apiSuccess({
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('[API] Admin delete role error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
