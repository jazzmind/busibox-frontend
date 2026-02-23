/**
 * Library Browser Component
 * 
 * Displays available apps from the library that can be installed
 */

'use client';

import { useState, useEffect } from 'react';
import { Button, AppIcon } from '@jazzmind/busibox-app';
import { APP_LIBRARY, type LibraryApp } from '@jazzmind/busibox-app/lib/deploy/app-library';
import { CustomAppInstaller } from './CustomAppInstaller';
import type { IconName } from '@jazzmind/busibox-app';
import type { BusiboxManifest } from '@jazzmind/busibox-app/lib/deploy/manifest-schema';

interface LibraryBrowserProps {
  onClose: () => void;
  onInstall: (app: LibraryApp) => void;
  onInstallCustom?: (manifest: BusiboxManifest, repoUrl: string, token?: string) => void;
}

export function LibraryBrowser({ onClose, onInstall, onInstallCustom }: LibraryBrowserProps) {
  const [libraryApps, setLibraryApps] = useState<LibraryApp[]>(APP_LIBRARY);
  const [installedApps, setInstalledApps] = useState<Set<string>>(new Set());
  const [installing, setInstalling] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCustomInstaller, setShowCustomInstaller] = useState(false);

  useEffect(() => {
    loadInstalledApps();
    loadLibraryApps();
  }, []);

  const loadLibraryApps = async () => {
    try {
      const response = await fetch('/api/library/apps', { cache: 'no-store' });
      const data = await response.json();
      if (data.success && Array.isArray(data.apps) && data.apps.length > 0) {
        setLibraryApps(data.apps);
      } else {
        setLibraryApps(APP_LIBRARY);
      }
    } catch {
      setLibraryApps(APP_LIBRARY);
    }
  };

  const loadInstalledApps = async () => {
    try {
      // Include disabled apps to check if they exist at all
      const response = await fetch('/api/apps?includeDisabled=true');
      const data = await response.json();
      
      if (data.success) {
        const installed = new Set<string>(
          data.data.apps
            .filter((app: any) => app.type === 'LIBRARY' && app.isActive)
            .map((app: any) => app.name)
        );
        setInstalledApps(installed);
      }
    } catch (error) {
      console.error('Failed to load installed apps:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (app: LibraryApp) => {
    setInstalling(app.id);
    try {
      const response = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: app.name,
          description: app.description,
          type: 'LIBRARY',
          url: app.defaultPath,
          selectedIcon: app.icon,
          isActive: true,
          healthEndpoint: app.healthEndpoint,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setInstalledApps(prev => new Set([...prev, app.name]));
        onInstall(app);
      } else {
        alert(`Failed to install ${app.name}: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to install app:', error);
      alert(`Failed to install ${app.name}`);
    } finally {
      setInstalling(null);
    }
  };

  const handleCustomInstall = (manifest: BusiboxManifest, repoUrl: string, token?: string) => {
    if (onInstallCustom) {
      onInstallCustom(manifest, repoUrl, token);
    }
    setShowCustomInstaller(false);
  };

  if (showCustomInstaller) {
    return (
      <CustomAppInstaller
        onClose={() => setShowCustomInstaller(false)}
        onInstall={handleCustomInstall}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">App Library</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select apps to install from the library
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Custom App Button */}
          {onInstallCustom && (
            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={() => setShowCustomInstaller(true)}
                fullWidth
              >
                <svg className="w-4 h-4 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Install Custom App from GitHub
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {libraryApps.map((app) => {
                const isInstalled = installedApps.has(app.name);
                const isInstalling = installing === app.id;

                return (
                  <div
                    key={app.id}
                    className={`border rounded-lg p-4 transition-all ${
                      isInstalled
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AppIcon iconName={app.icon as IconName} size="lg" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{app.name}</h3>
                          {isInstalled && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              ✓ Installed
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">
                          {app.description}
                        </p>
                        
                        <div className="space-y-1 text-xs text-gray-500">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Path:</span>
                            <code className="bg-gray-100 px-1 py-0.5 rounded">{app.defaultPath}</code>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Port:</span>
                            <code className="bg-gray-100 px-1 py-0.5 rounded">{app.defaultPort}</code>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Repository:</span>
                            <code className="bg-gray-100 px-1 py-0.5 rounded">{app.githubRepo}</code>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          {isInstalled ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              fullWidth
                              disabled
                            >
                              Already Installed
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              fullWidth
                              onClick={() => handleInstall(app)}
                              loading={isInstalling}
                              disabled={isInstalling}
                            >
                              {isInstalling ? 'Installing...' : 'Install App'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

