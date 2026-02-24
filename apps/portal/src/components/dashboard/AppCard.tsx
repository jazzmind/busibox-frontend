/**
 * App Card Component
 * 
 * Displays an application tile with icon, name, and description.
 * All apps use SSO token exchange — in the monorepo each app runs
 * as a separate Next.js app with its own basePath.
 */

'use client';

import { useState } from 'react';
import type { DashboardApp } from '@/types';
import { AppIcon } from '@jazzmind/busibox-app';

export type AppCardProps = {
  app: DashboardApp;
};

export function AppCard({ app }: AppCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // All non-portal apps require SSO token exchange before redirect.
  // In the monorepo, /chat, /documents, /admin etc. are separate Next.js apps,
  // so they all need SSO — nothing is a "portal-internal route" anymore.
  const usesSsoLaunch = true;

  const handleSSOAppClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Generate SSO token for external/library app access
      const response = await fetch('/api/auth/sso/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: app.id }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success && data.data.redirectUrl) {
        // Redirect to app with token
        window.location.href = data.data.redirectUrl;
      } else {
        setError(data.error || 'Failed to generate SSO token');
        setLoading(false);
      }
    } catch (err) {
      console.error('SSO token generation error:', err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const cardContent = (
    <div className="group relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 h-full">
      <div className="p-6 flex flex-col items-center text-center h-full">
        {/* Icon */}
        <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
          <AppIcon 
            iconName={app.selectedIcon}
            iconUrl={app.iconUrl}
            size="lg"
          />
        </div>

        {/* Name */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
          {app.name}
        </h3>

        {/* Description */}
        {app.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-grow">
            {app.description}
          </p>
        )}

        {/* Status Badge */}
        <div className="mt-auto w-full">
          {loading ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium w-full justify-center">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connecting...
            </div>
          ) : usesSsoLaunch ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              SSO Enabled
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Access
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg w-full">
            <p className="text-xs text-red-600 text-center">
              {error}
            </p>
          </div>
        )}
      </div>

      {/* Subtle hover gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-300 pointer-events-none rounded-xl" />
    </div>
  );

  // Disabled state - apps without URLs can't be launched
  if (!app.url) {
    return (
      <div className="cursor-not-allowed opacity-60">
        {cardContent}
      </div>
    );
  }

  // All apps need SSO token exchange before redirect.
  return (
    <button
      onClick={handleSSOAppClick}
      disabled={loading}
      className="block w-full text-left disabled:opacity-75 disabled:cursor-not-allowed"
    >
      {cardContent}
    </button>
  );
}
