/**
 * Library Detail API Route
 *
 * GET: Get library details
 * PATCH: Update library (admin or creator only)
 * DELETE: Soft delete library (admin or creator only)
 *
 * Role-library bindings are stored in the authz service.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { canAccessLibrary, canManageLibrary, isCustomPersonalLibrary } from '@jazzmind/busibox-app/lib/data/libraries';
import {
  getRole,
  getResourceRoles,
  grantRoleResourceAccess,
  revokeRoleResourceAccess,
  listRoleBindings,
} from '@jazzmind/busibox-app';
import { getAuthzOptions } from '@jazzmind/busibox-app/lib/authz/next-client';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function fetchLibraryFromDataApi(
  libraryId: string,
  userId: string,
  sessionJwt: string
): Promise<Record<string, unknown> | null> {
  const tokenResult = await exchangeWithSubjectToken({
    sessionJwt,
    userId,
    audience: 'data-api',
    scopes: ['data:read'],
    purpose: 'library-operations',
  });

  const response = await fetch(`${getDataApiUrl()}/libraries/${libraryId}`, {
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
    },
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.data || null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id } = await params;

    const hasAccess = await canAccessLibrary(user.id, id, sessionJwt);
    if (!hasAccess) {
      return apiError('Library not found or access denied', 404);
    }

    const library = await fetchLibraryFromDataApi(id, user.id, sessionJwt);

    if (!library || library.deletedAt) {
      return apiError('Library not found', 404);
    }

    let roles: { id: string; name: string; description: string | null }[] = [];
    if (!library.isPersonal) {
      try {
        const options = getAuthzOptions();
        const roleBindings = await getResourceRoles('library', id, options);
        roles = roleBindings.map((rb) => ({
          id: rb.id,
          name: rb.name,
          description: rb.description || null,
        }));
      } catch (error) {
        console.error('[API] Error getting library roles:', error);
      }
    }

    return apiSuccess({
      library: {
        ...library,
        role: null,
        roles,
      },
    });
  } catch (error: unknown) {
    console.error('[API] Get library error:', error);
    return apiError(error instanceof Error ? error.message : 'An unexpected error occurred', 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id } = await params;

    const canManage = await canManageLibrary(user.id, id, sessionJwt);
    if (!canManage) {
      return apiError('Access denied', 403);
    }

    const body = await request.json();
    const { name, description, metadata, roleIds, addRoleIds, removeRoleIds } = body;

    const existing = await fetchLibraryFromDataApi(id, user.id, sessionJwt);

    if (!existing || existing.deletedAt) {
      return apiError('Library not found', 404);
    }

    if (existing.isPersonal && !isCustomPersonalLibrary(existing)) {
      return apiError('Cannot modify default personal libraries', 400);
    }

    const options = getAuthzOptions();

    // Build data-api update payload (name, description, metadata)
    const updatePayload: Record<string, unknown> = {};
    if (name && typeof name === 'string') updatePayload.name = name;
    if (description !== undefined) updatePayload.description = description;
    if (metadata !== undefined) updatePayload.metadata = metadata;

    if (Object.keys(updatePayload).length > 0) {
      const tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId: user.id,
        audience: 'data-api',
        scopes: ['data:write'],
        purpose: 'library-operations',
      });

      const updateResponse = await fetch(`${getDataApiUrl()}/libraries/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('[API] Data-api update failed:', updateResponse.status, errorText);
        return apiError('Failed to update library', 500);
      }
    }

    if (!existing.isPersonal && roleIds && Array.isArray(roleIds)) {
      const existingBindings = await listRoleBindings(
        { resource_type: 'library', resource_id: id },
        options
      );

      for (const binding of existingBindings) {
        if (!roleIds.includes(binding.role_id)) {
          await revokeRoleResourceAccess(binding.role_id, 'library', id, options);
        }
      }

      const existingRoleIds = new Set(existingBindings.map((b) => b.role_id));
      for (const roleId of roleIds) {
        if (!existingRoleIds.has(roleId)) {
          const role = await getRole(roleId, options);
          if (!role) {
            return apiError(`Role not found: ${roleId}`, 400);
          }
          await grantRoleResourceAccess(roleId, 'library', id, undefined, options);
        }
      }
    }

    if (!existing.isPersonal && addRoleIds && Array.isArray(addRoleIds)) {
      for (const roleId of addRoleIds) {
        const role = await getRole(roleId, options);
        if (!role) {
          return apiError(`Role not found: ${roleId}`, 400);
        }
        try {
          await grantRoleResourceAccess(roleId, 'library', id, undefined, options);
        } catch (e: unknown) {
          const err = e as { message?: string };
          if (!err.message?.includes('409') && !err.message?.includes('conflict')) {
            throw e;
          }
        }
      }
    }

    if (!existing.isPersonal && removeRoleIds && Array.isArray(removeRoleIds)) {
      for (const roleId of removeRoleIds) {
        await revokeRoleResourceAccess(roleId, 'library', id, options);
      }
    }

    const library = await fetchLibraryFromDataApi(id, user.id, sessionJwt);
    let roles: { id: string; name: string; description: string | null }[] = [];
    if (!existing.isPersonal) {
      const roleBindings = await getResourceRoles('library', id, options);
      roles = roleBindings.map((rb) => ({
        id: rb.id,
        name: rb.name,
        description: rb.description || null,
      }));
    }

    return apiSuccess({
      library: {
        ...library,
        role: null,
        roles,
      },
    });
  } catch (error: unknown) {
    console.error('[API] Update library error:', error);
    return apiError(error instanceof Error ? error.message : 'An unexpected error occurred', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id } = await params;

    const canManage = await canManageLibrary(user.id, id, sessionJwt);
    if (!canManage) {
      return apiError('Access denied', 403);
    }

    const existing = await fetchLibraryFromDataApi(id, user.id, sessionJwt);

    if (!existing || existing.deletedAt) {
      return apiError('Library not found', 404);
    }

    if (existing.isPersonal && !isCustomPersonalLibrary(existing)) {
      return apiError('Cannot delete default personal libraries. Only custom libraries can be deleted.', 400);
    }

    if (!existing.isPersonal) {
      try {
        const options = getAuthzOptions();
        const bindings = await listRoleBindings(
          { resource_type: 'library', resource_id: id },
          options
        );
        for (const binding of bindings) {
          await revokeRoleResourceAccess(binding.role_id, 'library', id, options);
        }
      } catch (error) {
        console.error('[API] Error removing library role bindings:', error);
      }
    }

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:write'],
      purpose: 'library-operations',
    });

    // Forward document_action and targetLibraryId query params
    const url = new URL(request.url);
    const documentAction = url.searchParams.get('document_action') || 'orphan';
    const targetLibraryId = url.searchParams.get('targetLibraryId') || '';
    const deleteUrl = new URL(`${getDataApiUrl()}/libraries/${id}`);
    deleteUrl.searchParams.set('document_action', documentAction);
    if (targetLibraryId) {
      deleteUrl.searchParams.set('targetLibraryId', targetLibraryId);
    }

    const deleteResponse = await fetch(deleteUrl.toString(), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('[API] Data-api delete failed:', deleteResponse.status, errorText);
      return apiError('Failed to delete library', 500);
    }

    return apiSuccess({ message: 'Library deleted successfully' });
  } catch (error: unknown) {
    console.error('[API] Delete library error:', error);
    return apiError(error instanceof Error ? error.message : 'An unexpected error occurred', 500);
  }
}
