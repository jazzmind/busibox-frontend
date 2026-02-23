/**
 * Portal Customization Form
 * 
 * Admin form for customizing portal branding with autosave.
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@jazzmind/busibox-app';
import { RefreshCw, Check } from 'lucide-react';
import type { PortalCustomization } from '@jazzmind/busibox-app';

type BrandingSection = 'identity' | 'colors' | 'location' | 'contact' | 'advanced';

type CustomizationFormProps = {
  customization: PortalCustomization;
  onSuccess?: () => void;
  section?: BrandingSection;
};

const AUTOSAVE_DELAY = 800;

export function CustomizationForm({ customization, onSuccess, section }: CustomizationFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    companyName: customization.companyName,
    siteName: customization.siteName,
    slogan: customization.slogan,
    logoUrl: customization.logoUrl || '',
    faviconUrl: customization.faviconUrl || '',
    primaryColor: customization.primaryColor,
    secondaryColor: customization.secondaryColor,
    textColor: customization.textColor,
    addressLine1: customization.addressLine1,
    addressLine2: customization.addressLine2 || '',
    addressCity: customization.addressCity || '',
    addressState: customization.addressState,
    addressZip: customization.addressZip || '',
    addressCountry: customization.addressCountry,
    supportEmail: customization.supportEmail || '',
    supportPhone: customization.supportPhone || '',
    customCss: customization.customCss || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const save = useCallback(async (data: typeof formData) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch('/api/portal-customization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (result.success) {
        setSaved(true);
        if (onSuccess) onSuccess();
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(result.error || 'Failed to update customization');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }, [onSuccess, router]);

  const update = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save(next), AUTOSAVE_DELAY);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Company Identity */}
      {(!section || section === 'identity') && <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Identity</h3>
        <div className="space-y-4">
          <Input
            label="Company Name"
            value={formData.companyName}
            onChange={(e) => update('companyName', e.target.value)}
            placeholder="Busibox Portal"
            helperText="Used in the footer copyright notice"
            required
          />
          <Input
            label="Site Name"
            value={formData.siteName}
            onChange={(e) => update('siteName', e.target.value)}
            placeholder="Busibox Portal"
            helperText="Used in the header and page title"
            required
          />
          <Input
            label="Slogan"
            value={formData.slogan}
            onChange={(e) => update('slogan', e.target.value)}
            placeholder="How about a nice game of chess?"
            required
          />
          <Input
            label="Logo URL"
            type="url"
            value={formData.logoUrl}
            onChange={(e) => update('logoUrl', e.target.value)}
            placeholder="https://example.com/logo.png"
            helperText="Optional. URL to your company logo."
          />
          <Input
            label="Favicon URL"
            type="url"
            value={formData.faviconUrl}
            onChange={(e) => update('faviconUrl', e.target.value)}
            placeholder="https://example.com/favicon.ico"
            helperText="Optional. URL to your favicon."
          />
        </div>
      </div>}

      {/* Color Scheme */}
      {(!section || section === 'colors') && <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Color Scheme</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={formData.primaryColor}
                onChange={(e) => update('primaryColor', e.target.value)}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <Input
                value={formData.primaryColor}
                onChange={(e) => update('primaryColor', e.target.value)}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={formData.secondaryColor}
                onChange={(e) => update('secondaryColor', e.target.value)}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <Input
                value={formData.secondaryColor}
                onChange={(e) => update('secondaryColor', e.target.value)}
                placeholder="#8B0000"
                className="flex-1"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Text Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={formData.textColor}
                onChange={(e) => update('textColor', e.target.value)}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <Input
                value={formData.textColor}
                onChange={(e) => update('textColor', e.target.value)}
                placeholder="#FFFFFF"
                className="flex-1"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 border border-gray-200 rounded">
          <p className="text-sm text-gray-600 mb-2">Preview:</p>
          <div
            className="p-4 rounded"
            style={{
              backgroundColor: formData.primaryColor,
              color: formData.textColor,
              border: `2px solid ${formData.secondaryColor}`
            }}
          >
            <h4 className="font-bold text-lg">{formData.companyName}</h4>
            <p className="text-sm mt-1">{formData.slogan}</p>
          </div>
        </div>
      </div>}

      {/* Address */}
      {(!section || section === 'location') && <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Address</h3>
        <div className="space-y-4">
          <Input
            label="Address Line 1"
            value={formData.addressLine1}
            onChange={(e) => update('addressLine1', e.target.value)}
            placeholder="123 Main St"
            required
          />
          <Input
            label="Address Line 2"
            value={formData.addressLine2}
            onChange={(e) => update('addressLine2', e.target.value)}
            placeholder="Suite 100"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="City"
              value={formData.addressCity}
              onChange={(e) => update('addressCity', e.target.value)}
              placeholder="Las Vegas"
            />
            <Input
              label="State"
              value={formData.addressState}
              onChange={(e) => update('addressState', e.target.value)}
              placeholder="NV"
              required
            />
            <Input
              label="Zip Code"
              value={formData.addressZip}
              onChange={(e) => update('addressZip', e.target.value)}
              placeholder="89101"
            />
          </div>
          <Input
            label="Country"
            value={formData.addressCountry}
            onChange={(e) => update('addressCountry', e.target.value)}
            placeholder="USA"
            required
          />
        </div>
      </div>}

      {/* Contact Information */}
      {(!section || section === 'contact') && <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
        <div className="space-y-4">
          <Input
            label="Support Email"
            type="email"
            value={formData.supportEmail}
            onChange={(e) => update('supportEmail', e.target.value)}
            placeholder="support@example.com"
            helperText="Optional. Support contact email."
          />
          <Input
            label="Support Phone"
            type="tel"
            value={formData.supportPhone}
            onChange={(e) => update('supportPhone', e.target.value)}
            placeholder="+1 (555) 123-4567"
            helperText="Optional. Support contact phone."
          />
        </div>
      </div>}

      {/* Custom CSS */}
      {(!section || section === 'advanced') && <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Custom CSS</label>
          <textarea
            value={formData.customCss}
            onChange={(e) => update('customCss', e.target.value)}
            placeholder=".custom-class { color: red; }"
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Optional. Add custom CSS to further customize the portal appearance.
          </p>
        </div>
      </div>}

      {/* Autosave status */}
      <div className="flex justify-end">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {saving && <><RefreshCw className="w-3 h-3 animate-spin" /> Saving...</>}
          {!saving && saved && <><Check className="w-3 h-3 text-green-500" /> Saved</>}
        </div>
      </div>
    </div>
  );
}
