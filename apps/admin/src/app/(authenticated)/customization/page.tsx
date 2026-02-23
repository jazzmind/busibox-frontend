/**
 * Admin Portal Customization Page
 * 
 * Manage portal branding and appearance.
 * Uses portal-config-store (data-api) for configuration storage.
 */

import { redirect } from 'next/navigation';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { CustomizationForm } from '@/components/admin/CustomizationForm';
import { Button } from '@jazzmind/busibox-app';
import {
  getDataApiTokenForUser,
  getPortalConfigFromDataApi,
  getDefaultPortalConfig,
} from '@jazzmind/busibox-app/lib/data/portal-config';
import Link from 'next/link';

export const metadata = {
  title: 'Portal Customization - Admin Portal',
  description: 'Customize portal branding and appearance',
};

export default async function PortalCustomizationPage() {
  const currentUser = await getCurrentUserWithSessionFromCookies();
  
  if (!currentUser) {
    redirect('/portal/login');
  }

  if (!currentUser.roles?.includes('Admin')) {
    redirect('/portal/home');
  }

  // Get current customization from data-api via portal-config-store
  let customization;
  try {
    const tokenResult = await getDataApiTokenForUser(currentUser.id, currentUser.sessionJwt);
    customization = await getPortalConfigFromDataApi(tokenResult.accessToken);
  } catch (error) {
    console.error('[Customization Page] Failed to load from data-api, using defaults:', error);
    customization = getDefaultPortalConfig();
  }

  // Map PortalConfig to the PortalCustomization shape that CustomizationForm expects.
  // PortalCustomization requires addressState and addressCountry as non-null strings.
  const formData = {
    id: 'portal-customization',
    companyName: customization.companyName,
    siteName: customization.siteName,
    slogan: customization.slogan,
    logoUrl: customization.logoUrl,
    faviconUrl: customization.faviconUrl,
    primaryColor: customization.primaryColor,
    secondaryColor: customization.secondaryColor,
    textColor: customization.textColor,
    addressLine1: customization.addressLine1,
    addressLine2: customization.addressLine2,
    addressCity: customization.addressCity,
    addressState: customization.addressState ?? 'NV',
    addressZip: customization.addressZip,
    addressCountry: customization.addressCountry ?? 'USA',
    supportEmail: customization.supportEmail,
    supportPhone: customization.supportPhone,
    customCss: customization.customCss,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Portal Customization</h1>
              <p className="text-gray-600 mt-1">Customize your portal's branding and appearance</p>
            </div>
            
            <Link href="/">
              <Button variant="secondary">
                ← Back to Admin
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CustomizationForm customization={formData} />
      </main>
    </div>
  );
}

