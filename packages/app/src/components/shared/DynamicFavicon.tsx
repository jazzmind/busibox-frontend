'use client';

import { useEffect } from 'react';
import { useCustomization } from '../../contexts/CustomizationContext';

/**
 * Dynamic Favicon Component
 *
 * Updates the favicon based on portal customization settings.
 * Falls back to default favicon if no custom favicon is set.
 */
export function DynamicFavicon() {
  const { customization } = useCustomization();

  useEffect(() => {
    const faviconUrl = customization.faviconUrl || '/favicon.svg';

    // Update all favicon links
    const links = document.querySelectorAll("link[rel*='icon']");
    links.forEach((link) => link.remove());

    // Add new favicon
    const newLink = document.createElement('link');
    newLink.rel = 'icon';
    newLink.href = faviconUrl;

    // Set type based on URL extension
    if (faviconUrl.endsWith('.svg')) {
      newLink.type = 'image/svg+xml';
    } else if (faviconUrl.endsWith('.png')) {
      newLink.type = 'image/png';
    } else if (faviconUrl.endsWith('.ico')) {
      newLink.type = 'image/x-icon';
    }

    document.head.appendChild(newLink);
  }, [customization.faviconUrl]);

  return null;
}








