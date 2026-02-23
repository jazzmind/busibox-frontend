/**
 * Libraries API Route
 *
 * GET: List all libraries accessible to the user
 * POST: Create a new shared library (admin only)
 *
 * Role-library bindings are stored in the authz service.
 */

import { NextRequest } from 'next/server';
import { requireAuth, requireAdminAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { getUserLibraries } from '@jazzmind/busibox-app/lib/data/libraries';
import {
  listRoles,
  getUserRoles,
  grantRoleResourceAccess,
} from '@jazzmind/busibox-app';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function GET(request: NextRequest) {
  try {
    console.log('[API/libraries] GET request received');

    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      console.log('[API/libraries] Auth failed, returning error response');
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    console.log('[API/libraries] Authenticated user:', user.id, 'roles:', user.roles);

    let libraries: any[] = [];
    try {
      libraries = await getUserLibraries(user.id, sessionJwt);
      console.log('[API/libraries] getUserLibraries returned:', libraries.length, 'libraries');
    } catch (libError: unknown) {
      console.error('[API/libraries] getUserLibraries error:', libError);
      if (libError instanceof Error) {
        console.error('[API/libraries] Error stack:', libError.stack);
      }
    }

    console.log('[API/libraries] Returning libraries:', libraries.length, 'for user:', user.id);

    libraries.forEach((lib, i) => {
      console.log(`[API/libraries] Library ${i}: ${lib.name} (isPersonal: ${lib.isPersonal}, type: ${lib.libraryType})`);
    });

    return apiSuccess({ libraries: libraries || [] });
  } catch (error: unknown) {
    console.error('[API/libraries] List libraries error:', error);
    if (error instanceof Error) {
      console.error('[API/libraries] Error stack:', error.stack);
    }
    return apiError(error instanceof Error ? error.message : 'An unexpected error occurred', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const body = await request.json();
    const options = await getAuthzOptionsWithToken(sessionJwt);

    const { name, roleId, roleIds } = body;

    if (!name || typeof name !== 'string') {
      return apiError('Library name is required', 400);
    }

    const roleIdsToUse: string[] = roleIds || (roleId ? [roleId] : []);

    if (roleIdsToUse.length === 0) {
      return apiError('At least one role is required', 400);
    }

    const allRoles = await listRoles(options);
    const validRoleIds = new Set(allRoles.map((r) => r.id));
    const invalidRoleIds = roleIdsToUse.filter((rid) => !validRoleIds.has(rid));

    if (invalidRoleIds.length > 0) {
      return apiError('One or more invalid role IDs', 400);
    }

    const userRoles = await getUserRoles(user.id, options);
    const userRoleIds = userRoles.map((r) => r.id);

    const hasAtLeastOneRole = roleIdsToUse.some((rid) => userRoleIds.includes(rid));

    if (!hasAtLeastOneRole) {
      const selectedRoles = allRoles.filter((r) => roleIdsToUse.includes(r.id));
      const roleNames = selectedRoles.map((r) => r.name).join(', ');
      return apiError(
        `You must select at least one role that you have. You selected: ${roleNames}, but you don't have any of these roles. Add a role you have to be able to see this library.`,
        400
      );
    }

    // Create library in data-api
    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:read', 'data:write'],
      purpose: 'library-operations',
    });

    const dataApiUrl = getDataApiUrl();
    const createResponse = await fetch(`${dataApiUrl}/libraries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
      body: JSON.stringify({
        name,
        isPersonal: false,
        createdBy: user.id,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('[API/libraries] Data-api create failed:', createResponse.status, errorText);
      return apiError('Failed to create library', 500);
    }

    const createData = await createResponse.json();
    const library = createData.data || createData;

    // Create role-library bindings in authz
    for (const rid of roleIdsToUse) {
      await grantRoleResourceAccess(rid, 'library', library.id, undefined, options);
    }

    const selectedRoles = allRoles.filter((r) => roleIdsToUse.includes(r.id));

    const libraryWithRoles = {
      ...library,
      role: null,
      roles: selectedRoles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description || null,
      })),
    };

    return apiSuccess({ library: libraryWithRoles }, 201);
  } catch (error: unknown) {
    console.error('[API] Create library error:', error);
    return apiError(error instanceof Error ? error.message : 'An unexpected error occurred', 500);
  }
}
