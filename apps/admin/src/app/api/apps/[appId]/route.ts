/**
 * Admin App Detail API
 *
 * GET /api/apps/[appId] - Get app details
 * PATCH /api/apps/[appId] - Update app
 * DELETE /api/apps/[appId] - Delete app
 *
 * Role-app bindings are stored in the authz service.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import { logAppUpdated, logAppDeleted } from '@jazzmind/busibox-app/lib/authz/audit';
import { validateExternalAppUrl } from '@jazzmind/busibox-app/lib/deploy/url-validation';
import {
  getResourceRoles,
  listRoleBindings,
  revokeRoleResourceAccess,
} from '@jazzmind/busibox-app';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import {
  getAllAppConfigs,
  getAppConfigById,
  updateAppConfig,
  deleteAppConfig,
  findAppConfigByPath,
  resolveStableSsoAudience,
} from '@jazzmind/busibox-app/lib/deploy/app-config';

type RouteParams = {
  params: Promise<{ appId: string }>;
};

// GET /api/apps/[appId] - Get app details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const { appId } = await params;

    const options = await getAuthzOptionsWithToken(sessionJwt);
    const app = await getAppConfigById(
      { userId: authResult.user.id, sessionJwt: authResult.sessionJwt },
      appId
    );

    if (!app) return apiError('App not found', 404);

    const roleBindings = await getResourceRoles('app', appId, options);

    return apiSuccess({
      app: {
        id: app.id,
        name: app.name,
        description: app.description,
        type: app.type,
        url: app.url,
        iconUrl: app.iconUrl,
        selectedIcon: app.selectedIcon,
        primaryColor: app.primaryColor,
        secondaryColor: app.secondaryColor,
        displayOrder: app.displayOrder,
        isActive: app.isActive,
        healthEndpoint: app.healthEndpoint,
        hasClientSecret: !!app.oauthClientSecret,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        roles: roleBindings.map((rb) => ({
          roleId: rb.id,
          roleName: rb.name,
        })),
      },
    });
  } catch (error) {
    console.error('[API] Admin get app error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// PATCH /api/apps/[appId] - Update app
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser } = authResult;
    const { appId } = await params;
    const body = await parseJsonBody(request);

    const existingApp = await getAppConfigById(
      { userId: authResult.user.id, sessionJwt: authResult.sessionJwt },
      appId
    );
    if (!existingApp) return apiError('App not found', 404);

    const allApps = await getAllAppConfigs({
      userId: authResult.user.id,
      sessionJwt: authResult.sessionJwt,
    });

    const updateData: Record<string, unknown> = {};
    if (!existingApp.ssoAudience) {
      updateData.ssoAudience = resolveStableSsoAudience(existingApp);
    }

    if (body.name !== undefined) {
      if (body.name !== existingApp.name) {
        const nameConflict = allApps.find((app) => app.id !== appId && app.name === body.name);
        if (nameConflict) return apiError('An app with this name already exists', 409);
      }
      updateData.name = body.name;
    }

    if (body.description !== undefined) updateData.description = body.description || null;

    if (body.url !== undefined) {
      if (existingApp.type === 'EXTERNAL' && body.url) {
        const isDevMode = body.devMode !== undefined ? body.devMode : existingApp.devMode;
        const urlValidation = validateExternalAppUrl(body.url, isDevMode);
        if (!urlValidation.valid) return apiError(urlValidation.error || 'Invalid URL', 400);
      }
      updateData.url = body.url || null;
    }

    if (body.iconUrl !== undefined) updateData.iconUrl = body.iconUrl || null;
    if (body.selectedIcon !== undefined) updateData.selectedIcon = body.selectedIcon || null;
    if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor || null;
    if (body.secondaryColor !== undefined) updateData.secondaryColor = body.secondaryColor || null;
    if (body.githubToken !== undefined) updateData.githubToken = body.githubToken || null;
    if (body.displayOrder !== undefined) updateData.displayOrder = parseInt(body.displayOrder, 10);
    if (body.isActive !== undefined) updateData.isActive = body.isActive === true;

    if (body.healthEndpoint !== undefined) {
      if (body.healthEndpoint && !body.healthEndpoint.startsWith('/')) {
        return apiError('Health endpoint must start with /', 400);
      }
      updateData.healthEndpoint = body.healthEndpoint || '/api/health';
    }

    if (body.deployedPath !== undefined) {
      if (body.deployedPath && !body.deployedPath.startsWith('/')) {
        return apiError('Deployed path must start with /', 400);
      }
      if (body.deployedPath && body.deployedPath !== existingApp.deployedPath) {
        const pathConflict = await findAppConfigByPath(
          { userId: authResult.user.id, sessionJwt: authResult.sessionJwt },
          body.deployedPath,
          { excludeId: appId }
        );
        if (pathConflict) {
          return apiError(`Path '${body.deployedPath}' is already used by ${pathConflict.name}`, 409);
        }
      }
      updateData.deployedPath = body.deployedPath || null;
    }

    if (body.devMode !== undefined) updateData.devMode = body.devMode;

    const updatedApp = await updateAppConfig(
      { userId: authResult.user.id, sessionJwt: authResult.sessionJwt },
      appId,
      updateData
    );
    if (!updatedApp) return apiError('App not found', 404);

    await logAppUpdated(appId, updatedApp.name, adminUser.id, updateData);

    return apiSuccess({
      app: {
        id: updatedApp.id,
        name: updatedApp.name,
        description: updatedApp.description,
        type: updatedApp.type,
        url: updatedApp.url,
        iconUrl: updatedApp.iconUrl,
        selectedIcon: updatedApp.selectedIcon,
        primaryColor: updatedApp.primaryColor,
        secondaryColor: updatedApp.secondaryColor,
        displayOrder: updatedApp.displayOrder,
        isActive: updatedApp.isActive,
        healthEndpoint: updatedApp.healthEndpoint,
        updatedAt: updatedApp.updatedAt,
      },
    });
  } catch (error) {
    console.error('[API] Admin update app error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// DELETE /api/apps/[appId] - Delete app
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const { appId } = await params;
    const options = await getAuthzOptionsWithToken(sessionJwt);

    const existingApp = await getAppConfigById(
      { userId: authResult.user.id, sessionJwt: authResult.sessionJwt },
      appId
    );
    if (!existingApp) return apiError('App not found', 404);

    try {
      const bindings = await listRoleBindings({ resource_type: 'app', resource_id: appId }, options);
      for (const binding of bindings) {
        await revokeRoleResourceAccess(binding.role_id, 'app', appId, options);
      }
    } catch (error) {
      console.error('[API] Error removing app role bindings:', error);
    }

    await deleteAppConfig({ userId: authResult.user.id, sessionJwt: authResult.sessionJwt }, appId);
    await logAppDeleted(appId, existingApp.name, adminUser.id);

    return apiSuccess({ message: 'App deleted successfully' });
  } catch (error) {
    console.error('[API] Admin delete app error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
