import { getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz';
import {
  getAppConfigStoreContextForUser,
  listAppsFromStore,
} from '@jazzmind/busibox-app/lib/deploy/app-config';

/**
 * Resolve an app's resource ID (UUID) from a sourceApp name.
 *
 * Looks up the app registry to find a matching app by ssoAudience or name,
 * then returns its UUID for use with resourceId-scoped token exchange.
 *
 * @returns app UUID or null if not found
 */
export async function resolveAppResourceId(
  sessionJwt: string,
  sourceApp: string,
): Promise<string | null> {
  try {
    const userId = getUserIdFromSessionJwt(sessionJwt);
    const ctx = await getAppConfigStoreContextForUser(userId, sessionJwt);
    const apps = await listAppsFromStore(ctx.accessToken);

    const match = apps.find(
      (app) => app.ssoAudience === sourceApp || app.name === sourceApp,
    );

    return match?.id ?? null;
  } catch (err) {
    console.error('[app-lookup] Failed to resolve app resource ID for', sourceApp, err);
    return null;
  }
}
