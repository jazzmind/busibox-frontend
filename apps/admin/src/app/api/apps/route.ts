/**
 * Admin Apps API
 *
 * GET /api/apps - List all applications
 * POST /api/apps - Register new application
 *
 * Role-app bindings are stored in the authz service.
 */

import { NextRequest } from 'next/server';
import {
  requireAdminAuth,
  apiSuccess,
  apiError,
  parseJsonBody,
  validateRequiredFields,
} from '@jazzmind/busibox-app/lib/next/middleware';
import { logAppRegistered } from '@jazzmind/busibox-app/lib/authz/audit';
import { validateExternalAppUrl } from '@jazzmind/busibox-app/lib/deploy/url-validation';
import { isGitHubUrl, fetchAndValidateManifest } from '@jazzmind/busibox-app/lib/deploy/github-manifest';
import { validateManifest } from '@jazzmind/busibox-app/lib/deploy/manifest-schema';
import { deployApp } from '@jazzmind/busibox-app/lib/deploy/deployment-client';
import { listRoleBindings, exchangeTokenZeroTrust, getRoleByName, grantRoleResourceAccess } from '@jazzmind/busibox-app';
import { getAuthzOptionsWithToken, getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';
import {
  type AppConfigRecord,
  type AppConfigType,
  createAppInStore,
  getAppConfigStoreContextForUser,
  listAppsForWrite,
  listAppsFromStore,
  resolveStableSsoAudience,
} from '@jazzmind/busibox-app/lib/deploy/app-config';

function isValidAppType(value: string): value is AppConfigType {
  return value === 'BUILT_IN' || value === 'LIBRARY' || value === 'EXTERNAL';
}

function makeCreatePayload(input: Partial<AppConfigRecord> & { id: string; name: string; type: AppConfigType }) {
  return {
    id: input.id,
    name: input.name,
    ssoAudience: input.ssoAudience ?? null,
    description: input.description ?? null,
    type: input.type,
    url: input.url ?? null,
    deployedPath: input.deployedPath ?? null,
    iconUrl: input.iconUrl ?? null,
    selectedIcon: input.selectedIcon ?? null,
    displayOrder: input.displayOrder ?? 0,
    isActive: input.isActive ?? true,
    healthEndpoint: input.healthEndpoint ?? null,
    oauthClientSecret: input.oauthClientSecret ?? null,
    githubToken: input.githubToken ?? null,
    githubRepo: input.githubRepo ?? null,
    lastDeploymentId: null,
    lastDeploymentStatus: null,
    lastDeploymentLogs: null,
    lastDeploymentStartedAt: null,
    lastDeploymentEndedAt: null,
    lastDeploymentError: null,
    deployedVersion: null,
    latestVersion: null,
    latestVersionCheckedAt: null,
    updateAvailable: false,
    devMode: input.devMode ?? false,
    primaryColor: input.primaryColor ?? null,
    secondaryColor: input.secondaryColor ?? null,
  };
}

/**
 * Auto-grant Admin role access to a newly created app.
 * Fails gracefully — the app is still created even if this fails.
 */
async function grantAdminRoleAccess(appId: string, sessionJwt: string): Promise<void> {
  try {
    const options = await getAuthzOptionsWithToken(sessionJwt);
    const adminRole = await getRoleByName('Admin', options);
    if (!adminRole) {
      console.warn('[API] Admin role not found — skipping auto-grant for new app');
      return;
    }
    await grantRoleResourceAccess(adminRole.id, 'app', appId, undefined, options);
    console.log(`[API] Granted Admin role access to new app: ${appId}`);
  } catch (error) {
    console.error('[API] Failed to auto-grant Admin access to new app:', error);
  }
}

// GET /api/apps
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user, sessionJwt } = authResult;
    const { searchParams } = new URL(request.url);
    const rawTypeFilter = searchParams.get('type');
    const includeDisabled = searchParams.get('includeDisabled') === 'true';
    const typeFilter: AppConfigType | null =
      rawTypeFilter && isValidAppType(rawTypeFilter) ? rawTypeFilter : null;

    const context = await getAppConfigStoreContextForUser(user.id, sessionJwt);
    const apps = (await listAppsFromStore(context.accessToken)).filter((app) => {
      if (typeFilter && app.type !== typeFilter) return false;
      if (includeDisabled) return true;
      if (typeFilter === 'BUILT_IN') return true;
      return app.isActive || app.type === 'BUILT_IN';
    });

    const options = await getAuthzOptionsWithToken(sessionJwt);
    const allBindings = await listRoleBindings({ resource_type: 'app' }, options);
    const bindingCountMap = new Map<string, number>();
    for (const binding of allBindings) {
      const count = bindingCountMap.get(binding.resource_id) || 0;
      bindingCountMap.set(binding.resource_id, count + 1);
    }

    return apiSuccess({
      apps: apps.map((app) => ({
        id: app.id,
        name: app.name,
        description: app.description,
        type: app.type,
        url: app.url,
        deployedPath: app.deployedPath,
        healthEndpoint: app.healthEndpoint,
        iconUrl: app.iconUrl,
        selectedIcon: app.selectedIcon,
        primaryColor: app.primaryColor,
        secondaryColor: app.secondaryColor,
        displayOrder: app.displayOrder,
        isActive: app.isActive,
        permissionCount: bindingCountMap.get(app.id) || 0,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        lastDeploymentStatus: app.lastDeploymentStatus,
        lastDeploymentEndedAt: app.lastDeploymentEndedAt,
        deployedVersion: app.deployedVersion,
        latestVersion: app.latestVersion,
        updateAvailable: app.updateAvailable ?? false,
        devMode: app.devMode ?? false,
      })),
    });
  } catch (error) {
    console.error('[API] Admin apps list error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// POST /api/apps
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const body = await parseJsonBody(request);
    const validationError = validateRequiredFields(body, ['name', 'type']);
    if (validationError) return apiError(validationError, 400);

    const { name, description, type, url, iconUrl, selectedIcon, displayOrder, githubToken, isActive: bodyIsActive, primaryColor, secondaryColor } = body;
    if (!isValidAppType(type)) {
      return apiError('Type must be BUILT_IN, LIBRARY, or EXTERNAL', 400);
    }
    // Respect the isActive value from the form; default depends on app type
    const requestedIsActive = typeof bodyIsActive === 'boolean' ? bodyIsActive : undefined;

    const context = await getAppConfigStoreContextForUser(adminUser.id, sessionJwt);
    const existingApps = await listAppsForWrite(context.accessToken, context.roleIds);

    const findNameConflict = (candidateNames: string[]) =>
      existingApps.find((app) => candidateNames.some((candidate) => app.name === candidate));
    const findPathConflict = (candidatePath: string) =>
      existingApps.find((app) => app.url === candidatePath || app.deployedPath === candidatePath);

    if (type === 'EXTERNAL') {
      if (!url) return apiError('URL is required for external apps', 400);

      const devMode = body.devMode === true;
      if (url.startsWith('local-dev://')) {
        const urlValidation = validateExternalAppUrl(url, devMode);
        if (!urlValidation.valid) return apiError(urlValidation.error || 'Invalid URL', 400);

        const localDevDir = url.replace('local-dev://', '');
        if (!localDevDir) return apiError('Local dev directory name is required', 400);

        const manifest = body.manifest;
        if (!manifest) return apiError('Manifest is required for local dev apps', 400);

        const schemaValidation = validateManifest(manifest);
        if (!schemaValidation.success) {
          const errors = (schemaValidation.errors ?? [])
            .map((e) => `${e.path}: ${e.message}`)
            .join('; ');
          return apiError(`Invalid manifest schema: ${errors}`, 400);
        }

        const existingAppById = findNameConflict([manifest.name, manifest.id]);
        if (existingAppById) {
          return apiError(`An app with name '${manifest.name}' or ID '${manifest.id}' already exists`, 409);
        }
        const existingPathApp = findPathConflict(manifest.defaultPath);
        if (existingPathApp) {
          return apiError(`Path '${manifest.defaultPath}' is already used by ${existingPathApp.name}`, 409);
        }

        const newApp = await createAppInStore(
          context.accessToken,
          context.roleIds,
          makeCreatePayload({
            id: crypto.randomUUID(),
            name: manifest.name,
            ssoAudience: manifest.id,
            description: description || manifest.description,
            type: 'EXTERNAL',
            url,
            deployedPath: manifest.defaultPath,
            selectedIcon: selectedIcon || manifest.icon,
            displayOrder: displayOrder || 0,
            isActive: requestedIsActive ?? false,
            healthEndpoint: manifest.healthEndpoint,
            devMode: true,
            primaryColor: primaryColor || null,
            secondaryColor: secondaryColor || null,
          })
        );

        const auditOptions = await getAuthzOptionsWithToken(sessionJwt);
        await logAppRegistered(newApp.id, newApp.name, adminUser.id, auditOptions);
        await grantAdminRoleAccess(newApp.id, sessionJwt);

        try {
          const exchangeResult = await exchangeTokenZeroTrust(
            {
              sessionJwt,
              audience: 'deploy-api',
              scopes: ['admin', 'deploy:write'],
              purpose: 'Deploy local dev app',
            },
            { authzBaseUrl: getAuthzBaseUrl(), verbose: false }
          );
          const deployment = await deployApp(
            { appId: newApp.id, appName: manifest.id, localDevDir, manifest, devMode: true },
            exchangeResult.accessToken
          );

          return apiSuccess(
            {
              app: {
                id: newApp.id,
                name: newApp.name,
                description: newApp.description,
                type: newApp.type,
                url: newApp.url,
                selectedIcon: newApp.selectedIcon,
                displayOrder: newApp.displayOrder,
                isActive: newApp.isActive,
                healthEndpoint: newApp.healthEndpoint,
                devMode: newApp.devMode,
                createdAt: newApp.createdAt,
              },
              deployment: { id: deployment.deploymentId, status: 'pending' },
              message: 'Local dev app registered and deployment initiated.',
            },
            201
          );
        } catch (deployError) {
          console.error('[API] Local dev deployment failed:', deployError);
          return apiSuccess(
            {
              app: {
                id: newApp.id,
                name: newApp.name,
                description: newApp.description,
                type: newApp.type,
                url: newApp.url,
                selectedIcon: newApp.selectedIcon,
                displayOrder: newApp.displayOrder,
                isActive: newApp.isActive,
                healthEndpoint: newApp.healthEndpoint,
                devMode: newApp.devMode,
                createdAt: newApp.createdAt,
              },
              message: 'App registered but deployment failed. Check logs for details.',
              error: deployError instanceof Error ? deployError.message : 'Deployment failed',
            },
            201
          );
        }
      }

      if (isGitHubUrl(url)) {
        const manifestResult = await fetchAndValidateManifest(url, githubToken);
        if (!manifestResult.valid || !manifestResult.manifest) {
          return apiError(manifestResult.error || 'Invalid manifest', 400);
        }

        const manifest = manifestResult.manifest;
        const schemaValidation = validateManifest(manifest);
        if (!schemaValidation.success) {
          const errors = (schemaValidation.errors ?? [])
            .map((e) => `${e.path}: ${e.message}`)
            .join('; ');
          return apiError(`Invalid manifest schema: ${errors}`, 400);
        }

        const existingAppById = findNameConflict([manifest.name, manifest.id]);
        if (existingAppById) {
          return apiError(`An app with name '${manifest.name}' or ID '${manifest.id}' already exists`, 409);
        }
        const existingPathApp = findPathConflict(manifest.defaultPath);
        if (existingPathApp) {
          return apiError(`Path '${manifest.defaultPath}' is already used by ${existingPathApp.name}`, 409);
        }

        const newApp = await createAppInStore(
          context.accessToken,
          context.roleIds,
          makeCreatePayload({
            id: crypto.randomUUID(),
            name: manifest.name,
            ssoAudience: manifest.id,
            description: description || manifest.description,
            type: 'EXTERNAL',
            url,
            deployedPath: manifest.defaultPath,
            selectedIcon: selectedIcon || manifest.icon,
            displayOrder: displayOrder || 0,
            isActive: requestedIsActive ?? false,
            healthEndpoint: manifest.healthEndpoint,
            githubToken: githubToken || null,
            primaryColor: primaryColor || null,
            secondaryColor: secondaryColor || null,
          })
        );

        const auditOptions = await getAuthzOptionsWithToken(sessionJwt);
        await logAppRegistered(newApp.id, newApp.name, adminUser.id, auditOptions);
        await grantAdminRoleAccess(newApp.id, sessionJwt);

        try {
          const exchangeResult = await exchangeTokenZeroTrust(
            {
              sessionJwt,
              audience: 'deploy-api',
              scopes: ['admin', 'deploy:write'],
              purpose: 'Deploy new app',
            },
            { authzBaseUrl: getAuthzBaseUrl(), verbose: false }
          );
          const deployment = await deployApp(
            {
              appId: newApp.id,
              appName: manifest.id,
              githubRepo: url,
              githubToken: githubToken || undefined,
              manifest,
              environment: 'production',
            },
            exchangeResult.accessToken
          );

          return apiSuccess(
            {
              app: {
                id: newApp.id,
                name: newApp.name,
                description: newApp.description,
                type: newApp.type,
                url: newApp.url,
                selectedIcon: newApp.selectedIcon,
                displayOrder: newApp.displayOrder,
                isActive: newApp.isActive,
                healthEndpoint: newApp.healthEndpoint,
                createdAt: newApp.createdAt,
              },
              deployment: { id: deployment.deploymentId, status: 'pending' },
              message: 'App registered and deployment initiated. Check deployment logs for progress.',
            },
            201
          );
        } catch (deployError) {
          console.error('[API] Deployment failed:', deployError);
          return apiSuccess(
            {
              app: {
                id: newApp.id,
                name: newApp.name,
                description: newApp.description,
                type: newApp.type,
                url: newApp.url,
                selectedIcon: newApp.selectedIcon,
                displayOrder: newApp.displayOrder,
                isActive: newApp.isActive,
                healthEndpoint: newApp.healthEndpoint,
                createdAt: newApp.createdAt,
              },
              message: 'App registered but deployment failed. Check logs for details.',
              error: deployError instanceof Error ? deployError.message : 'Deployment failed',
            },
            201
          );
        }
      }

      const urlValidation = validateExternalAppUrl(url);
      if (!urlValidation.valid) return apiError(urlValidation.error || 'Invalid URL', 400);

      const oauthClientSecret = `sso_${crypto.randomUUID().replace(/-/g, '')}`;
      const newAppId = crypto.randomUUID();
      const newApp = await createAppInStore(
        context.accessToken,
        context.roleIds,
        makeCreatePayload({
          id: newAppId,
          name,
          ssoAudience: resolveStableSsoAudience({ id: newAppId, name, url }),
          description: description || null,
          type: 'EXTERNAL',
          url: url || null,
          iconUrl: iconUrl || null,
          selectedIcon: selectedIcon || null,
          displayOrder: displayOrder || 0,
          isActive: requestedIsActive ?? true,
          oauthClientSecret,
          primaryColor: primaryColor || null,
          secondaryColor: secondaryColor || null,
        })
      );

      const auditOptions = await getAuthzOptionsWithToken(sessionJwt);
      await logAppRegistered(newApp.id, newApp.name, adminUser.id, auditOptions);
      await grantAdminRoleAccess(newApp.id, sessionJwt);

      return apiSuccess(
        {
          app: {
            id: newApp.id,
            name: newApp.name,
            description: newApp.description,
            type: newApp.type,
            url: newApp.url,
            iconUrl: newApp.iconUrl,
            displayOrder: newApp.displayOrder,
            isActive: newApp.isActive,
            oauthClientSecret: newApp.oauthClientSecret,
            createdAt: newApp.createdAt,
          },
          message: 'App registered successfully. Save the client secret - it will not be shown again!',
        },
        201
      );
    }

    // BUILT_IN or LIBRARY
    if (!url) return apiError('Path is required for built-in and library apps', 400);

    const reservedPaths = ['/', '/home', '/portal', '/login', '/api', '/admin', '/videos', '/auth', '/sso', '/callback'];
    const normalizedPath = url.toLowerCase().trim();
    if (reservedPaths.some((reserved) => normalizedPath === reserved || normalizedPath.startsWith(`${reserved}/`))) {
      return apiError(`Path '${url}' conflicts with Busibox Portal reserved paths`, 400);
    }
    if (!/^\/[a-z0-9-_]+$/.test(url)) {
      return apiError('Path must start with / and contain only lowercase letters, numbers, hyphens, and underscores', 400);
    }

    const existingPathApp = existingApps.find(
      (app) => app.url === url && (app.type === 'BUILT_IN' || app.type === 'LIBRARY')
    );
    if (existingPathApp) {
      return apiError(`Path '${url}' is already used by ${existingPathApp.name}`, 409);
    }

    const existingApp = existingApps.find((app) => app.name === name);
    if (existingApp) return apiError('An app with this name already exists', 409);

    const newAppId = crypto.randomUUID();
    const newApp = await createAppInStore(
      context.accessToken,
      context.roleIds,
      makeCreatePayload({
        id: newAppId,
        name,
        ssoAudience: resolveStableSsoAudience({ id: newAppId, name, url }),
        description: description || null,
        type,
        url: url || null,
        iconUrl: iconUrl || null,
          selectedIcon: selectedIcon || null,
          displayOrder: displayOrder || 0,
          isActive: requestedIsActive ?? true,
          primaryColor: primaryColor || null,
          secondaryColor: secondaryColor || null,
        })
      );

      await logAppRegistered(newApp.id, newApp.name, adminUser.id);
      await grantAdminRoleAccess(newApp.id, sessionJwt);
    return apiSuccess(
      {
        app: {
          id: newApp.id,
          name: newApp.name,
          description: newApp.description,
          type: newApp.type,
          url: newApp.url,
          iconUrl: newApp.iconUrl,
          displayOrder: newApp.displayOrder,
          isActive: newApp.isActive,
          createdAt: newApp.createdAt,
        },
        message: 'App registered successfully',
      },
      201
    );
  } catch (error) {
    console.error('[API] Admin register app error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
