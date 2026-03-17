/**
 * App-Specific Permission Checks
 *
 * Combines authz RBAC bindings with the app config store to determine
 * whether a user can access a particular deployed app.
 *
 * These functions live here (not in authz/) because they depend on the
 * deploy/app-config store for app metadata — they are not pure authz concepts.
 */

import {
  userCanAccessResource,
  getUserAccessibleResources,
  type RbacClientOptions,
} from '@jazzmind/busibox-app';
import { getAuthzOptions } from '../authz/next-client';
import { getAppByIdFromStore, getAppConfigStoreContextForUser, listAppsFromStore } from './app-config';

/**
 * Get RBAC options with session JWT for self-service operations.
 *
 * Authz accepts session JWTs directly for self-service operations
 * (user checking their own access, listing their own resources).
 * No token exchange is required.
 */
function getRbacOptionsWithToken(sessionJwt: string): RbacClientOptions {
  return {
    accessToken: sessionJwt,
    ...getAuthzOptions(),
  };
}

/**
 * Check if a user can access a specific app.
 *
 * Queries the authz service to check if the user has any role
 * that is bound to the specified app.
 *
 * @param userId - User ID to check
 * @param appId - App ID to check access for
 * @param accessToken - Access token for authenticated check
 * @returns true if user has permission, false otherwise
 */
export async function canAccessApp(userId: string, appId: string, accessToken?: string): Promise<boolean> {
  try {
    if (!accessToken) {
      return false;
    }

    const appStoreContext = await getAppConfigStoreContextForUser(userId, accessToken);
    const app = await getAppByIdFromStore(appStoreContext.accessToken, appId);

    if (!app || !app.isActive) {
      return false;
    }

    const options = getRbacOptionsWithToken(accessToken);
    return await userCanAccessResource(userId, 'app', appId, options);
  } catch (error) {
    console.error('[APP-PERMISSIONS] Error checking app access:', error);
    return false;
  }
}

/**
 * Get all apps a user can access.
 *
 * Queries the authz service for accessible app IDs, then fetches
 * app details from the app config store.
 *
 * @param userId - User ID
 * @param accessToken - Access token for authenticated check
 * @returns Array of apps the user has permission to access
 */
export async function getUserApps(userId: string, accessToken?: string) {
  try {
    if (!accessToken) {
      return [];
    }

    const options = getRbacOptionsWithToken(accessToken);
    const accessibleAppIds = await getUserAccessibleResources(userId, 'app', options);

    if (accessibleAppIds.length === 0) {
      return [];
    }

    const appStoreContext = await getAppConfigStoreContextForUser(userId, accessToken);
    const accessibleSet = new Set(accessibleAppIds);
    return (await listAppsFromStore(appStoreContext.accessToken))
      .filter((app) => app.isActive && accessibleSet.has(app.id))
      .map((app) => ({
        id: app.id,
        name: app.name,
        description: app.description,
        type: app.type,
        url: app.url,
        iconUrl: app.iconUrl,
        selectedIcon: app.selectedIcon,
        displayOrder: app.displayOrder,
        isActive: app.isActive,
        lastDeploymentStatus: app.lastDeploymentStatus ?? null,
        deployedPath: app.deployedPath ?? null,
      }));
  } catch (error) {
    console.error('[APP-PERMISSIONS] Error getting user apps:', error);
    return [];
  }
}
