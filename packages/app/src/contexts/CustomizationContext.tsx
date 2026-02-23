/**
 * Portal Customization Context
 * 
 * Provides portal branding and customization across the app.
 * Can be configured with a custom API endpoint or default values.
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type PortalCustomization = {
  id?: string;
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
  addressState: string;
  addressZip: string | null;
  addressCountry: string;
  supportEmail: string | null;
  supportPhone: string | null;
  customCss: string | null;
};

type CustomizationContextType = {
  customization: PortalCustomization;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const defaultCustomization: PortalCustomization = {
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
};

const CustomizationContext = createContext<CustomizationContextType>({
  customization: defaultCustomization,
  isLoading: false,
  error: null,
  refresh: async () => {},
});

export function useCustomization() {
  return useContext(CustomizationContext);
}

export type CustomizationProviderProps = {
  children: React.ReactNode;
  /** API endpoint to fetch customization from. If not provided, uses default values. */
  apiEndpoint?: string;
  /** Initial customization values. If provided, skips API fetch. */
  initialCustomization?: PortalCustomization;
};

export function CustomizationProvider({ 
  children, 
  apiEndpoint = '/api/portal-customization',
  initialCustomization 
}: CustomizationProviderProps) {
  const [customization, setCustomization] = useState<PortalCustomization>(
    initialCustomization || defaultCustomization
  );
  const [isLoading, setIsLoading] = useState(!initialCustomization);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomization = async () => {
    if (initialCustomization) {
      // Skip fetch if initial customization is provided
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(apiEndpoint);

      if (!response.ok) {
        // Non-OK response (e.g. 401 when not logged in, 500, etc.)
        // Try to parse JSON for structured error, but don't fail if body isn't JSON
        try {
          const data = await response.json();
          setError(data.error || `Failed to load customization (${response.status})`);
        } catch {
          setError(`Failed to load customization (${response.status})`);
        }
        return;
      }

      const data = await response.json();

      if (data.success && data.data?.customization) {
        setCustomization(data.data.customization);
      } else {
        setError(data.error || 'Failed to load customization');
      }
    } catch (err) {
      console.error('Failed to fetch customization:', err);
      setError('Failed to load customization');
      // Keep default customization on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomization();
  }, []);

  // Apply CSS variables when customization changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty('--color-primary', customization.primaryColor);
      document.documentElement.style.setProperty('--color-secondary', customization.secondaryColor);
      document.documentElement.style.setProperty('--color-text', customization.textColor);

      // Update page title only if siteName is set
      if (customization.siteName) {
        document.title = customization.siteName;
      }

      // Apply custom CSS if provided
      if (customization.customCss) {
        let styleEl = document.getElementById('portal-custom-css');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'portal-custom-css';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = customization.customCss;
      }
    }
  }, [customization]);

  return (
    <CustomizationContext.Provider
      value={{
        customization,
        isLoading,
        error,
        refresh: fetchCustomization,
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
}
