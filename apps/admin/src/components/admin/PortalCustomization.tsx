/**
 * Portal Customization Component
 * 
 * Optional branding and settings configuration during setup.
 * Matches /about page aesthetic.
 */

'use client';

import { useState } from 'react';

export type PortalCustomizationProps = {
  onComplete: () => void;
  onSkip: () => void;
};

export function PortalCustomization({ onComplete, onSkip }: PortalCustomizationProps) {
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#f97316');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Save customization settings
      await fetch('/api/portal-customization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          primaryColor,
        }),
      });

      onComplete();
    } catch (error) {
      console.error('Failed to save customization:', error);
      // Continue anyway
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="py-20 lg:py-28 relative overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="custom-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M0 32V0h32" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#custom-grid)" />
          </svg>
        </div>
        {/* Gradient accent */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-purple-100/40 via-transparent to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto px-6 relative">
          <h1 className="text-4xl lg:text-6xl font-semibold text-gray-900 tracking-tight leading-tight">
            Customize Your <span className="text-orange-500">Portal</span>
          </h1>
          <p className="mt-6 text-xl lg:text-2xl text-gray-600 max-w-2xl leading-relaxed">
            Optional: Add your branding and customize the portal appearance.
          </p>
        </div>
      </section>

      {/* Customization Form */}
      <section className="pb-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-8">
            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <input
                type="text"
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corporation"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Displayed in the portal header and emails
              </p>
            </div>

            {/* Logo URL */}
            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Logo URL
              </label>
              <input
                type="url"
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                URL to your company logo (optional)
              </p>
            </div>

            {/* Primary Color */}
            <div>
              <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 mb-2">
                Primary Color
              </label>
              <div className="flex gap-4 items-center">
                <input
                  type="color"
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-12 w-24 border border-gray-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#f97316"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono text-sm"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Used for buttons, links, and accents throughout the portal
              </p>
            </div>

            {/* Preview */}
            {(companyName || logoUrl) && (
              <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Preview</h3>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    {logoUrl && (
                      <img src={logoUrl} alt="Logo" className="h-8 w-auto" onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }} />
                    )}
                    {companyName && (
                      <span className="text-lg font-semibold text-gray-900">{companyName}</span>
                    )}
                  </div>
                  <button
                    style={{ backgroundColor: primaryColor }}
                    className="px-4 py-2 text-white font-medium rounded-lg"
                  >
                    Sample Button
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save and Continue'}
            </button>
            <button
              onClick={onSkip}
              disabled={isSaving}
              className="px-8 py-3 text-gray-700 font-medium rounded-lg border border-gray-300 hover:border-gray-400 transition-colors"
            >
              Skip for Now
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            You can update these settings anytime from the admin dashboard.
          </p>
        </div>
      </section>
    </div>
  );
}
