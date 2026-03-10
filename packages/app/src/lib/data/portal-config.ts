/**
 * Portal Configuration — backed by config-api.
 *
 * Branding is public (no auth). Admin writes require an admin config-api token.
 * This replaces the previous data-api–backed implementation.
 */

import {
  getBranding,
  getConfigApiToken,
  updateBranding as configApiUpdateBranding,
  type BrandingConfig,
} from '../config/client';

export type PortalConfig = {
  companyName: string;
  siteName: string;
  slogan: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  addressLine1: string;
  addressLine2: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  customCss: string | null;
  setupComplete: boolean;
  setupCompletedAt: string | null;
  setupCompletedBy: string | null;
};

const DEFAULT_CONFIG: PortalConfig = {
  companyName: 'Busibox Portal',
  siteName: 'Busibox Portal',
  slogan: 'How about a nice game of chess?',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#000000',
  secondaryColor: '#8B0000',
  textColor: '#FFFFFF',
  addressLine1: 'Cheyenne Mountain',
  addressLine2: null,
  addressCity: null,
  addressState: 'NV',
  addressZip: null,
  addressCountry: 'USA',
  supportEmail: null,
  supportPhone: null,
  customCss: null,
  setupComplete: false,
  setupCompletedAt: null,
  setupCompletedBy: null,
};

function brandingToPortalConfig(branding: BrandingConfig): PortalConfig {
  return {
    ...DEFAULT_CONFIG,
    companyName: branding.companyName || DEFAULT_CONFIG.companyName,
    siteName: branding.siteName || DEFAULT_CONFIG.siteName,
    slogan: branding.slogan || DEFAULT_CONFIG.slogan,
    logoUrl: branding.logoUrl || null,
    faviconUrl: branding.faviconUrl || null,
    primaryColor: branding.primaryColor || DEFAULT_CONFIG.primaryColor,
    secondaryColor: branding.secondaryColor || DEFAULT_CONFIG.secondaryColor,
    textColor: branding.textColor || DEFAULT_CONFIG.textColor,
    addressLine1: branding.addressLine1 || DEFAULT_CONFIG.addressLine1,
    addressLine2: branding.addressLine2 || null,
    addressCity: branding.addressCity || null,
    addressState: branding.addressState || null,
    addressZip: branding.addressZip || null,
    addressCountry: branding.addressCountry || null,
    supportEmail: branding.supportEmail || null,
    supportPhone: branding.supportPhone || null,
    customCss: branding.customCss || null,
    setupComplete: branding.setupComplete === 'true',
    setupCompletedAt: null,
    setupCompletedBy: null,
  };
}

type DataApiToken = { accessToken: string };

export async function getDataApiTokenForUser(userId: string, sessionJwt: string): Promise<DataApiToken> {
  const token = await getConfigApiToken(userId, sessionJwt);
  return { accessToken: token };
}

export async function getPortalConfigFromDataApi(_token: string): Promise<PortalConfig> {
  try {
    const branding = await getBranding();
    return brandingToPortalConfig(branding);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function getSharedRoleIdsForConfig(
  _dataApiAccessToken: string,
  _sessionJwt?: string,
): string[] {
  return [];
}

export async function upsertPortalConfigInDataApi(
  token: string,
  updates: Partial<PortalConfig>,
  _roleIds: string[],
): Promise<PortalConfig> {
  const brandingUpdates: Partial<BrandingConfig> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      (brandingUpdates as Record<string, string>)[key] = typeof value === 'boolean' ? String(value) : String(value);
    }
  }
  const branding = await configApiUpdateBranding(token, brandingUpdates);
  return brandingToPortalConfig(branding);
}

export function getDefaultPortalConfig(): PortalConfig {
  return { ...DEFAULT_CONFIG };
}

export async function syncSiteNameToDeployApi(
  _userId: string,
  _sessionJwt: string,
  _siteName: string,
): Promise<void> {
  // No longer needed — site name is stored directly in config-api branding.
}
