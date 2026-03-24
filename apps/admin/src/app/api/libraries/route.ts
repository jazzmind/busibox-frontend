/**
 * Admin Libraries API Route
 *
 * GET: Lists shared libraries from data-api + app-data libraries
 * POST: Create a new shared library (with role bindings)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';
import { getRoleResourceBindings, listRoles, grantRoleResourceAccess } from '@jazzmind/busibox-app';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) {
      return apiError('Invalid session', 401);
    }

    // 1. Fetch shared libraries from data-api (GET /libraries?include_shared=true)
    let libraries: unknown[] = [];
    try {
      const dataApiUrl = getDataApiUrl();
      const tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId,
        audience: 'data-api',
        scopes: ['data:read', 'data:write'],
        purpose: 'admin-libraries',
      });

      const libResponse = await fetch(`${dataApiUrl}/libraries?include_shared=true`, {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
      });

      if (libResponse.ok) {
        const data = await libResponse.json();
        const libs = data.data || [];
        const sharedLibs = libs.filter((l: { isPersonal?: boolean; sourceApp?: string }) => !l.isPersonal && !l.sourceApp);

        const options = await getAuthzOptionsWithToken(sessionJwt);

        libraries = await Promise.all(
          sharedLibs.map(async (lib: { id: string; name: string; libraryType?: string; documentCount?: number; createdAt?: string }) => {
            let roles: { id: string; name: string }[] = [];
            try {
              const bindings = await getRoleResourceBindings(lib.id, 'library', options);
              roles = bindings.map((b: { role_id: string; role_name?: string }) => ({
                id: b.role_id,
                name: b.role_name || b.role_id,
              }));
            } catch (e) {
              console.error(`[admin/libraries] Failed to get role bindings for library ${lib.id}:`, e);
            }

            return {
              id: lib.id,
              name: lib.name,
              description: (lib as { description?: string }).description || undefined,
              isPersonal: false,
              libraryType: lib.libraryType,
              documentCount: lib.documentCount || 0,
              totalSize: 0,
              createdAt: lib.createdAt,
              roles,
            };
          })
        );

        console.log('[admin/libraries] Got shared libraries from data-api:', libraries.length);
      }
    } catch (dbError) {
      console.error('[admin/libraries] Failed to fetch libraries from data-api:', dbError);
    }

    // 2. Fetch app-data libraries from data-api
    let appDataLibraries: unknown[] = [];
    try {
      if (userId) {
        const dataApiUrl = getDataApiUrl();
        const tokenResult = await exchangeWithSubjectToken({
          sessionJwt,
          userId,
          audience: 'data-api',
          purpose: 'admin-libraries',
        });

        const appDataResponse = await fetch(`${dataApiUrl}/libraries/app-data`, {
          headers: {
            Authorization: `Bearer ${tokenResult.accessToken}`,
          },
        });

        if (appDataResponse.ok) {
          const data = await appDataResponse.json();
          console.log('[admin/libraries] Raw app-data response:', JSON.stringify(data).slice(0, 500));
          appDataLibraries = Array.isArray(data) ? data : (data.data || data.appDataLibraries || []);
          console.log('[admin/libraries] Got app-data libraries:', appDataLibraries.length);
        } else {
          console.error('[admin/libraries] Failed to fetch app-data:', appDataResponse.status);
        }
      }
    } catch (error) {
      console.error('[admin/libraries] Failed to fetch app-data from data API:', error);
    }

    return apiSuccess({ libraries, appDataLibraries });
  } catch (error) {
    console.error('Libraries API error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) {
      return apiError('Invalid session', 401);
    }

    const body = await request.json();
    const { name, description, roleIds, metadata } = body;

    if (!name || typeof name !== 'string') {
      return apiError('Library name is required', 400);
    }

    const roleIdsToUse: string[] = roleIds || [];
    if (roleIdsToUse.length === 0) {
      return apiError('At least one role is required', 400);
    }

    const options = await getAuthzOptionsWithToken(sessionJwt);
    const allRoles = await listRoles(options);
    const validRoleIds = new Set(allRoles.map((r: { id: string }) => r.id));
    const invalidRoleIds = roleIdsToUse.filter((rid: string) => !validRoleIds.has(rid));

    if (invalidRoleIds.length > 0) {
      return apiError('One or more invalid role IDs', 400);
    }

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId,
      audience: 'data-api',
      scopes: ['data:read', 'data:write'],
      purpose: 'admin-library-create',
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
        description: description || undefined,
        isPersonal: false,
        createdBy: userId,
        metadata: metadata || undefined,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('[admin/libraries] Data-api create failed:', createResponse.status, errorText);
      return apiError('Failed to create library', 500);
    }

    const createData = await createResponse.json();
    const library = createData.data || createData;

    for (const rid of roleIdsToUse) {
      await grantRoleResourceAccess(rid, 'library', library.id, undefined, options);
    }

    const selectedRoles = allRoles.filter((r: { id: string }) => roleIdsToUse.includes(r.id));

    return apiSuccess({
      library: {
        ...library,
        roles: selectedRoles.map((r: { id: string; name: string; description?: string | null }) => ({
          id: r.id,
          name: r.name,
          description: r.description || null,
        })),
      },
    }, 201);
  } catch (error) {
    console.error('[admin/libraries] Create error:', error);
    return apiError('Internal server error', 500);
  }
}
