/**
 * Custom App Installer Component
 * 
 * UI for installing apps from custom GitHub repositories.
 */

'use client';

import { useState } from 'react';
import { Button, Input } from '@jazzmind/busibox-app';
import { fetchManifestFromUrl, parseGitHubUrl } from '@jazzmind/busibox-app/lib/deploy/manifest';
import type { BusiboxManifest } from '@jazzmind/busibox-app/lib/deploy/manifest-schema';
import type { IconName } from '@jazzmind/busibox-app';

interface CustomAppInstallerProps {
  onClose: () => void;
  onInstall: (manifest: BusiboxManifest, repoUrl: string, token?: string) => void;
}

export function CustomAppInstaller({ onClose, onInstall }: CustomAppInstallerProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [manifest, setManifest] = useState<BusiboxManifest | null>(null);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Array<{ path: string; message: string }>>([]);

  const handleFetchManifest = async () => {
    setLoading(true);
    setError('');
    setValidationErrors([]);
    setManifest(null);

    try {
      const result = await fetchManifestFromUrl(repoUrl, token || undefined, branch);

      if (!result.success) {
        setError(result.error || 'Failed to fetch manifest');
        if (result.validationErrors) {
          setValidationErrors(result.validationErrors);
        }
        return;
      }

      setManifest(result.manifest!);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = () => {
    if (!manifest) return;
    onInstall(manifest, repoUrl, token || undefined);
  };

  const parsed = parseGitHubUrl(repoUrl);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Install Custom App</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Install an app from a GitHub repository with a busibox.json manifest
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!manifest ? (
            <div className="space-y-4">
              {/* Repository URL */}
              <Input
                label="GitHub Repository URL"
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo or owner/repo"
                helperText="Enter the GitHub repository URL containing a busibox.json manifest"
              />

              {/* Branch */}
              <Input
                label="Branch"
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                helperText="Branch to fetch the manifest from (default: main)"
              />

              {/* GitHub Token (optional) */}
              <Input
                label="GitHub Token (Optional)"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
                helperText="Required for private repositories. Leave empty to use default token."
              />

              {/* Repository Preview */}
              {parsed && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                    Repository Preview
                  </h4>
                  <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                    <div><strong>Owner:</strong> {parsed.owner}</div>
                    <div><strong>Repository:</strong> {parsed.repo}</div>
                    <div><strong>Branch:</strong> {branch}</div>
                    <div><strong>Manifest URL:</strong> <code className="text-xs">https://raw.githubusercontent.com/{parsed.owner}/{parsed.repo}/{branch}/busibox.json</code></div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
                    Error
                  </h4>
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                  
                  {validationErrors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-1">Validation Errors:</p>
                      <ul className="list-disc list-inside text-sm text-red-800 dark:text-red-300 space-y-1">
                        {validationErrors.map((err, idx) => (
                          <li key={idx}>
                            <strong>{err.path}:</strong> {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Fetch Button */}
              <Button
                variant="primary"
                onClick={handleFetchManifest}
                loading={loading}
                disabled={!repoUrl || loading}
                fullWidth
              >
                {loading ? 'Fetching Manifest...' : 'Fetch Manifest'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Manifest Preview */}
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-900 dark:text-green-200 mb-3">
                  ✓ Manifest Found
                </h4>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-medium text-green-900 dark:text-green-200">Name:</span>
                      <span className="ml-2 text-green-800 dark:text-green-300">{manifest.name}</span>
                    </div>
                    <div>
                      <span className="font-medium text-green-900 dark:text-green-200">ID:</span>
                      <span className="ml-2 text-green-800 dark:text-green-300">{manifest.id}</span>
                    </div>
                    <div>
                      <span className="font-medium text-green-900 dark:text-green-200">Version:</span>
                      <span className="ml-2 text-green-800 dark:text-green-300">{manifest.version}</span>
                    </div>
                    <div>
                      <span className="font-medium text-green-900 dark:text-green-200">App Mode:</span>
                      <span className="ml-2 text-green-800 dark:text-green-300">{manifest.appMode}</span>
                    </div>
                    <div>
                      <span className="font-medium text-green-900 dark:text-green-200">Path:</span>
                      <span className="ml-2 text-green-800 dark:text-green-300">{manifest.defaultPath}</span>
                    </div>
                    <div>
                      <span className="font-medium text-green-900 dark:text-green-200">Port:</span>
                      <span className="ml-2 text-green-800 dark:text-green-300">{manifest.defaultPort}</span>
                    </div>
                  </div>
                  
                  <div className="text-sm">
                    <span className="font-medium text-green-900 dark:text-green-200">Description:</span>
                    <p className="mt-1 text-green-800 dark:text-green-300">{manifest.description}</p>
                  </div>
                  
                  {manifest.database?.required && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded p-3">
                      <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                        🗄️ Database Required
                      </p>
                      <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                        A PostgreSQL database will be automatically provisioned: <code>{manifest.database.preferredName}</code>
                      </p>
                    </div>
                  )}
                  
                  {manifest.requiredEnvVars.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded p-3">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                        Required Environment Variables:
                      </p>
                      <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                        {manifest.requiredEnvVars.map((envVar) => (
                          <li key={envVar}>
                            <code className="bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded">{envVar}</code>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                        You'll configure these after installation
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setManifest(null)}
                  fullWidth
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleInstall}
                  fullWidth
                >
                  Install App
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
