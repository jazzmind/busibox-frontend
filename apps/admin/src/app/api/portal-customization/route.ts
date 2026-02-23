/**
 * Admin Portal Customization API
 * 
 * GET /api/portal-customization - Get current customization
 * PATCH /api/portal-customization - Update customization
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getDataApiTokenForUser,
  getPortalConfigFromDataApi,
  getSharedRoleIdsForConfig,
  syncSiteNameToDeployApi,
  type PortalConfig,
  upsertPortalConfigInDataApi,
} from '@jazzmind/busibox-app/lib/data/portal-config';

// GET /api/portal-customization - Get customization
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;
    const tokenResult = await getDataApiTokenForUser(user.id, sessionJwt);
    const customization = await getPortalConfigFromDataApi(tokenResult.accessToken);

    return apiSuccess({ customization });
  } catch (error) {
    console.error('[API] Admin get portal customization error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// PATCH /api/portal-customization - Update customization
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;

    const body = await parseJsonBody(request);
    const updateData: Partial<PortalConfig> = {};

    if (body.companyName !== undefined) {
      updateData.companyName = body.companyName;
    }

    if (body.siteName !== undefined) {
      updateData.siteName = body.siteName;
    }

    if (body.slogan !== undefined) {
      updateData.slogan = body.slogan;
    }

    if (body.logoUrl !== undefined) {
      updateData.logoUrl = body.logoUrl || null;
    }

    if (body.faviconUrl !== undefined) {
      updateData.faviconUrl = body.faviconUrl || null;
    }

    if (body.primaryColor !== undefined) {
      // Validate color format
      if (body.primaryColor && !/^#[0-9A-F]{6}$/i.test(body.primaryColor)) {
        return apiError('Invalid primary color format. Use hex format like #000000', 400);
      }
      updateData.primaryColor = body.primaryColor;
    }

    if (body.secondaryColor !== undefined) {
      if (body.secondaryColor && !/^#[0-9A-F]{6}$/i.test(body.secondaryColor)) {
        return apiError('Invalid secondary color format. Use hex format like #8B0000', 400);
      }
      updateData.secondaryColor = body.secondaryColor;
    }

    if (body.textColor !== undefined) {
      if (body.textColor && !/^#[0-9A-F]{6}$/i.test(body.textColor)) {
        return apiError('Invalid text color format. Use hex format like #FFFFFF', 400);
      }
      updateData.textColor = body.textColor;
    }

    if (body.addressLine1 !== undefined) {
      updateData.addressLine1 = body.addressLine1;
    }

    if (body.addressLine2 !== undefined) {
      updateData.addressLine2 = body.addressLine2 || null;
    }

    if (body.addressCity !== undefined) {
      updateData.addressCity = body.addressCity || null;
    }

    if (body.addressState !== undefined) {
      updateData.addressState = body.addressState;
    }

    if (body.addressZip !== undefined) {
      updateData.addressZip = body.addressZip || null;
    }

    if (body.addressCountry !== undefined) {
      updateData.addressCountry = body.addressCountry;
    }

    if (body.supportEmail !== undefined) {
      updateData.supportEmail = body.supportEmail || null;
    }

    if (body.supportPhone !== undefined) {
      updateData.supportPhone = body.supportPhone || null;
    }

    if (body.customCss !== undefined) {
      updateData.customCss = body.customCss || null;
    }

    const tokenResult = await getDataApiTokenForUser(user.id, sessionJwt);
    const roleIds = getSharedRoleIdsForConfig(tokenResult.accessToken, sessionJwt);
    const updated = await upsertPortalConfigInDataApi(tokenResult.accessToken, updateData, roleIds);

    if (updated.siteName) {
      await syncSiteNameToDeployApi(user.id, sessionJwt, updated.siteName);
    }

    return apiSuccess({
      customization: updated,
      message: 'Portal customization updated successfully',
    });
  } catch (error) {
    console.error('[API] Admin update portal customization error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

