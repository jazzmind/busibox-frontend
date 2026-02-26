/**
 * Admin Library Detail API Route
 *
 * GET: Get library details with role bindings
 * PUT: Update library (name, description, metadata, roles)
 * DELETE: Soft delete library + remove role bindings
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  exchangeWithSubjectToken,
  getUserIdFromSessionJwt,
  getAuthzOptionsWithToken,
} from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';
import {
  getResourceRoles,
  grantRoleResourceAccess,
  revokeRoleResourceAccess,
  listRoleBindings,
  getRole,
} from '@jazzmind/busibox-app';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getDataApiToken(sessionJwt: string, userId: string, scopes: string[] = ['data:read']) {
  return exchangeWithSubjectToken({
    sessionJwt,
    userId,
    audience: 'data-api',
    scopes,
    purpose: 'admin-library-detail',
  });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Invalid session', 401);

    const { id } = await params;
    const tokenResult = await getDataApiToken(sessionJwt, userId);
    const dataApiUrl = getDataApiUrl();

    const response = await fetch(`${dataApiUrl}/libraries/${id}`, {
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
    });

    if (!response.ok) {
      return apiError('Library not found', 404);
    }

    const data = await response.json();
    const library = data.data || data;

    let roles: { id: string; name: string; description: string | null }[] = [];
    if (!library.isPersonal) {
      try {
        const options = await getAuthzOptionsWithToken(sessionJwt);
        const roleBindings = await getResourceRoles('library', id, options);
        roles = roleBindings.map((rb: { id: string; name: string; description?: string }) => ({
          id: rb.id,
          name: rb.name,
          description: rb.description || null,
        }));
      } catch (e) {
        console.error(`[admin/libraries/${id}] Failed to get role bindings:`, e);
      }
    }

    return apiSuccess({ library: { ...library, roles } });
  } catch (error) {
    console.error('[admin/libraries] GET error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Invalid session', 401);

    const { id } = await params;
    const body = await request.json();
    const { name, description, metadata, roleIds } = body;

    const tokenResult = await getDataApiToken(sessionJwt, userId, ['data:read', 'data:write']);
    const dataApiUrl = getDataApiUrl();

    // Update library fields in data-api
    const updatePayload: Record<string, unknown> = {};
    if (name !== undefined) updatePayload.name = name;
    if (description !== undefined) updatePayload.description = description;
    if (metadata !== undefined) updatePayload.metadata = metadata;

    if (Object.keys(updatePayload).length > 0) {
      const updateResponse = await fetch(`${dataApiUrl}/libraries/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('[admin/libraries] Data-api update failed:', updateResponse.status, errorText);
        return apiError('Failed to update library', 500);
      }
    }

    // Update role bindings if provided
    if (roleIds && Array.isArray(roleIds)) {
      const options = await getAuthzOptionsWithToken(sessionJwt);

      const existingBindings = await listRoleBindings(
        { resource_type: 'library', resource_id: id },
        options
      );

      // Remove bindings not in the new list
      for (const binding of existingBindings) {
        if (!roleIds.includes(binding.role_id)) {
          await revokeRoleResourceAccess(binding.role_id, 'library', id, options);
        }
      }

      // Add new bindings
      const existingRoleIds = new Set(existingBindings.map((b: { role_id: string }) => b.role_id));
      for (const roleId of roleIds) {
        if (!existingRoleIds.has(roleId)) {
          const role = await getRole(roleId, options);
          if (role) {
            await grantRoleResourceAccess(roleId, 'library', id, undefined, options);
          }
        }
      }
    }

    // Fetch updated library
    const getResponse = await fetch(`${dataApiUrl}/libraries/${id}`, {
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
    });

    const getData = await getResponse.json();
    const library = getData.data || getData;

    let roles: { id: string; name: string; description: string | null }[] = [];
    try {
      const options = await getAuthzOptionsWithToken(sessionJwt);
      const roleBindings = await getResourceRoles('library', id, options);
      roles = roleBindings.map((rb: { id: string; name: string; description?: string }) => ({
        id: rb.id,
        name: rb.name,
        description: rb.description || null,
      }));
    } catch (e) {
      console.error(`[admin/libraries/${id}] Failed to get role bindings:`, e);
    }

    return apiSuccess({ library: { ...library, roles } });
  } catch (error) {
    console.error('[admin/libraries] PUT error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Invalid session', 401);

    const { id } = await params;

    // Remove role bindings first
    try {
      const options = await getAuthzOptionsWithToken(sessionJwt);
      const bindings = await listRoleBindings(
        { resource_type: 'library', resource_id: id },
        options
      );
      for (const binding of bindings) {
        await revokeRoleResourceAccess(binding.role_id, 'library', id, options);
      }
    } catch (e) {
      console.error(`[admin/libraries/${id}] Failed to remove role bindings:`, e);
    }

    // Delete library in data-api, forwarding document handling params
    const tokenResult = await getDataApiToken(sessionJwt, userId, ['data:read', 'data:write']);
    const dataApiUrl = getDataApiUrl();

    const url = new URL(request.url);
    const documentAction = url.searchParams.get('document_action') || 'orphan';
    const targetLibraryId = url.searchParams.get('targetLibraryId') || '';
    const deleteUrl = new URL(`${dataApiUrl}/libraries/${id}`);
    deleteUrl.searchParams.set('document_action', documentAction);
    if (targetLibraryId) {
      deleteUrl.searchParams.set('targetLibraryId', targetLibraryId);
    }

    const deleteResponse = await fetch(deleteUrl.toString(), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('[admin/libraries] Data-api delete failed:', deleteResponse.status, errorText);
      return apiError('Failed to delete library', 500);
    }

    return apiSuccess({ message: 'Library deleted successfully' });
  } catch (error) {
    console.error('[admin/libraries] DELETE error:', error);
    return apiError('Internal server error', 500);
  }
}
