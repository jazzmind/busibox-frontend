/**
 * Admin Roles API
 * 
 * GET /api/roles - List all roles
 * POST /api/roles - Create new role
 * 
 * All role management is handled by the authz service.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody, validateRequiredFields } from '@jazzmind/busibox-app/lib/next/middleware';
import { logRoleCreated } from '@jazzmind/busibox-app/lib/authz/audit';
import { listRoles, createRole, listUsers, getRoleResourceBindings } from '@jazzmind/busibox-app';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';

// GET /api/roles - List roles
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;

    // Get options with exchanged token
    const options = await getAuthzOptionsWithToken(sessionJwt);

    // Get all roles from authz
    const roles = await listRoles(options);

    // Get all users to count members per role
    const allUsersResponse = await listUsers({}, options);
    const memberCountMap = new Map<string, number>();
    for (const user of allUsersResponse.users) {
      for (const userRole of user.roles) {
        const count = memberCountMap.get(userRole.id) || 0;
        memberCountMap.set(userRole.id, count + 1);
      }
    }

    // Get app counts for each role
    const appCountMap = new Map<string, number>();
    for (const role of roles) {
      try {
        const appBindings = await getRoleResourceBindings(role.id, 'app', options);
        appCountMap.set(role.id, appBindings.length);
      } catch (error) {
        console.error(`[API] Error fetching app bindings for role ${role.id}:`, error);
        appCountMap.set(role.id, 0);
      }
    }

    // Transform to match existing API response format
    const transformedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.is_system || false,
      scopes: role.scopes || [],
      memberCount: memberCountMap.get(role.id) || 0,
      appCount: appCountMap.get(role.id) || 0,
      createdAt: new Date(role.created_at),
      updatedAt: new Date(role.updated_at),
    }));

    // Sort: system roles first, then alphabetically
    transformedRoles.sort((a, b) => {
      if (a.isSystem !== b.isSystem) {
        return a.isSystem ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return apiSuccess({ roles: transformedRoles });
  } catch (error) {
    console.error('[API] Admin roles list error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// POST /api/roles - Create role
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const body = await parseJsonBody(request);

    // Validate request
    const validationError = validateRequiredFields(body, ['name']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { name, description, scopes } = body;

    // Validate name length
    if (name.length < 3 || name.length > 50) {
      return apiError('Role name must be between 3 and 50 characters', 400);
    }

    // Validate scopes if provided
    if (scopes && !Array.isArray(scopes)) {
      return apiError('Scopes must be an array of strings', 400);
    }

    // Get options with exchanged token
    const options = await getAuthzOptionsWithToken(sessionJwt);

    // Create role in authz with scopes
    const newRole = await createRole(
      name,
      description || null,
      options,
      scopes || []
    );

    // Log role creation
    await logRoleCreated(newRole.id, newRole.name, adminUser.id);

    return apiSuccess({
      role: {
        id: newRole.id,
        name: newRole.name,
        description: newRole.description,
        isSystem: false,
        scopes: newRole.scopes || [],
        createdAt: new Date(newRole.created_at),
      },
    }, 201);
  } catch (error: any) {
    console.error('[API] Admin create role error:', error);
    
    // Handle duplicate name error
    if (error.message?.includes('409')) {
      return apiError('A role with this name already exists', 409);
    }
    
    return apiError('An unexpected error occurred', 500);
  }
}
