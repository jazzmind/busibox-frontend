/**
 * Portal Customization API
 * 
 * GET /api/portal-customization - Get current customization (public access)
 * POST /api/portal-customization - Update customization (admin only)
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, requireAdminAuth, requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getDataApiTokenForUser,
  getDefaultPortalConfig,
  getPortalConfigFromDataApi,
  getSharedRoleIdsForConfig,
  syncSiteNameToDeployApi,
  upsertPortalConfigInDataApi,
} from '@jazzmind/busibox-app/lib/data/portal-config';

// GET /api/portal-customization - Get customization (public)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      // Unauthenticated — return default customization
      const defaults = getDefaultPortalConfig();
      const { setupComplete, setupCompletedAt, ...customization } = defaults;
      return apiSuccess({ setupComplete, setupCompletedAt, customization });
    }

    const { user, sessionJwt } = authResult;
    const tokenResult = await getDataApiTokenForUser(user.id, sessionJwt);
    const config = await getPortalConfigFromDataApi(tokenResult.accessToken);
    const { setupComplete, setupCompletedAt, ...customization } = config;

    return apiSuccess({ setupComplete, setupCompletedAt, customization });
  } catch (error) {
    console.error('[API] Get portal customization error:', error);
    const defaults = getDefaultPortalConfig();
    const { setupComplete, setupCompletedAt, ...customization } = defaults;
    return apiSuccess({ setupComplete, setupCompletedAt, customization, degraded: true });
  }
}

// POST /api/portal-customization - Update customization (admin only)
export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const body = await request.json();
    const { user, sessionJwt } = authResult;
    const tokenResult = await getDataApiTokenForUser(user.id, sessionJwt);
    const roleIds = getSharedRoleIdsForConfig(tokenResult.accessToken, sessionJwt);

    const customization = await upsertPortalConfigInDataApi(tokenResult.accessToken, {
      companyName: body.companyName || undefined,
      siteName: body.siteName || undefined,
      slogan: body.slogan || undefined,
      logoUrl: body.logoUrl || null,
      faviconUrl: body.faviconUrl || null,
      primaryColor: body.primaryColor || undefined,
      secondaryColor: body.secondaryColor || undefined,
      textColor: body.textColor || undefined,
      addressLine1: body.addressLine1 || undefined,
      addressLine2: body.addressLine2 || null,
      addressCity: body.addressCity || null,
      addressState: body.addressState || undefined,
      addressZip: body.addressZip || null,
      addressCountry: body.addressCountry || undefined,
      supportEmail: body.supportEmail || null,
      supportPhone: body.supportPhone || null,
      customCss: body.customCss || null,
    }, roleIds);

    if (customization.siteName) {
      await syncSiteNameToDeployApi(user.id, sessionJwt, customization.siteName);
    }

    return apiSuccess({ customization });
  } catch (error) {
    console.error('[API] Save portal customization error:', error);
    return apiError('Failed to save customization', 500);
  }
}
