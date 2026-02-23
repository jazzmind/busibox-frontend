/**
 * AppListWithBrowser Component
 * 
 * Wraps AppList with LibraryBrowser functionality
 * 
 * Button style guide:
 * - Primary: solid background with primaryColor, white text
 * - Secondary: tinted background with color, contrast-safe text color
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppList } from './AppList';
import { LibraryBrowser } from './LibraryBrowser';
import { useCustomization } from '@jazzmind/busibox-app';
import { BookOpen } from 'lucide-react';
import { hexToRgb, getContrastSafeColor } from '@jazzmind/busibox-app/lib/utils';

export function AppListWithBrowser() {
  const router = useRouter();
  const { customization } = useCustomization();
  const [showBrowser, setShowBrowser] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  const handleInstall = () => {
    router.refresh();
    setShowBrowser(false);
  };

  // Get colors with contrast adjustment for dark mode
  const primaryColor = customization.primaryColor || customization.secondaryColor;
  const primaryRgb = hexToRgb(primaryColor) ?? { r: 59, g: 130, b: 246 };
  
  // For tinted button backgrounds, we use 15% opacity of the color
  // The text color needs to have good contrast against that tinted background
  // In dark mode, background is ~#1f2937 + 15% of primary color overlay
  // We use minContrast of 4.5 for WCAG AA compliance
  const contrastSafePrimary = getContrastSafeColor(
    primaryColor, 
    isDark,
    '#374151', // gray-700 - approximate tinted dark background
    '#fff7ed', // very light tint for light mode
    4.5
  );

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Applications</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage installed apps and install new ones from the library or GitHub
          </p>
        </div>
        <div className="flex gap-3">
          {/* Secondary action - tinted background with contrast-safe text */}
          <button
            onClick={() => setShowBrowser(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-80 transition-colors text-sm font-medium"
            style={{ 
              backgroundColor: `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)`,
              color: contrastSafePrimary,
            }}
          >
            <BookOpen className="w-4 h-4" />
            Browse Library
          </button>
        </div>
      </div>

      <AppList />

      {showBrowser && (
        <LibraryBrowser
          onClose={() => setShowBrowser(false)}
          onInstall={handleInstall}
        />
      )}
    </>
  );
}
