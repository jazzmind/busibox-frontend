/**
 * Deployment Configuration Form Component
 * Form for creating deployment configuration for an app
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@jazzmind/busibox-app';

interface DeploymentConfigFormProps {
  appId: string;
  appName: string;
  existingConfig?: any; // Existing config for edit mode
  onSuccess: () => void;
  onCancel?: () => void;
}

interface Repository {
  owner: string;
  name: string;
  full_name: string;
}

export function DeploymentConfigForm({ appId, appName, existingConfig, onSuccess, onCancel }: DeploymentConfigFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const isEditMode = !!existingConfig;
  
  // Form state
  const [githubRepoOwner, setGithubRepoOwner] = useState(existingConfig?.githubRepoOwner || '');
  const [githubRepoName, setGithubRepoName] = useState(existingConfig?.githubRepoName || '');
  const [githubBranch, setGithubBranch] = useState(existingConfig?.githubBranch || 'main');
  const [deployPath, setDeployPath] = useState(existingConfig?.deployPath || '');
  const [appPath, setAppPath] = useState('');
  const [port, setPort] = useState(existingConfig?.port?.toString() || '');
  const [healthEndpoint, setHealthEndpoint] = useState(existingConfig?.healthEndpoint || '/api/health');
  const [buildCommand, setBuildCommand] = useState(existingConfig?.buildCommand || 'npm run build');
  const [startCommand, setStartCommand] = useState(existingConfig?.startCommand || 'npm start');
  const [stagingEnabled, setStagingEnabled] = useState(existingConfig?.stagingEnabled || false);
  
  // Validation state
  const [repoVerified, setRepoVerified] = useState(isEditMode); // Auto-verify in edit mode
  const [pathValid, setPathValid] = useState(false);
  const [portValid, setPortValid] = useState(isEditMode); // Auto-valid in edit mode
  
  // Load next available port on mount (only if creating new)
  useEffect(() => {
    if (!isEditMode) {
      loadNextPort();
    }
  }, [isEditMode]);
  
  async function loadNextPort() {
    try {
      const res = await fetch('/api/deployments/config/helpers?action=next-port');
      if (res.ok) {
        const { port: nextPort } = await res.json();
        setPort(String(nextPort));
        setPortValid(true);
      }
    } catch (error) {
      console.error('Failed to load next port:', error);
    }
  }
  
  // Auto-generate paths when repo name changes
  useEffect(() => {
    if (githubRepoName) {
      const generatedDeployPath = `/srv/apps/${githubRepoName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')}`;
      
      const generatedAppPath = `/${githubRepoName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')}`;
      
      setDeployPath(generatedDeployPath);
      setAppPath(generatedAppPath);
      
      // Validate the generated app path
      validateAppPath(generatedAppPath);
    }
  }, [githubRepoName]);
  
  // Verify GitHub repository access
  async function verifyRepository() {
    if (!githubRepoOwner || !githubRepoName) {
      setError('Please enter repository owner and name');
      return;
    }
    
    setVerifying(true);
    setError('');
    setRepoVerified(false);
    
    try {
      // Test the repo configuration by creating a temp config to trigger verification
      // The API will verify access without saving
      const res = await fetch('/api/deployments/config/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepoOwner,
          githubRepoName,
        }),
      });
      
      if (res.ok) {
        setRepoVerified(true);
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Cannot access repository');
        setRepoVerified(false);
      }
    } catch (error) {
      console.error('Repository verification error:', error);
      setError('Failed to verify repository access');
      setRepoVerified(false);
    } finally {
      setVerifying(false);
    }
  }
  
  // Validate app path
  async function validateAppPath(path: string) {
    if (!path) {
      setPathValid(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/deployments/config/helpers?action=validate-path&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      
      if (data.valid) {
        setPathValid(true);
        setError('');
      } else {
        setPathValid(false);
        setError(data.error || 'Invalid path');
      }
    } catch (error) {
      console.error('Path validation error:', error);
      setPathValid(false);
    }
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!isEditMode && !repoVerified) {
      setError('Please verify repository access first');
      return;
    }
    
    if (!isEditMode && !pathValid) {
      setError('Please fix the app path');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const url = isEditMode 
        ? `/api/deployments/config/${existingConfig.id}`
        : '/api/deployments/config';
      
      const method = isEditMode ? 'PATCH' : 'POST';
      
      const body = isEditMode ? {
        // Only send fields that can be updated
        githubBranch,
        deployPath,
        port: parseInt(port, 10),
        healthEndpoint,
        buildCommand,
        startCommand,
        stagingEnabled,
      } : {
        // Send all fields for creation
        appId,
        githubRepoOwner,
        githubRepoName,
        githubBranch,
        deployPath,
        port: parseInt(port, 10),
        healthEndpoint,
        buildCommand,
        startCommand,
        stagingEnabled,
      };
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        onSuccess();
      } else {
        const errorData = await res.json();
        setError(errorData.error || `Failed to ${isEditMode ? 'update' : 'save'} configuration`);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}
      
      {/* GitHub Repository */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900">GitHub Repository</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repository Owner <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={githubRepoOwner}
              onChange={(e) => {
                setGithubRepoOwner(e.target.value);
                setRepoVerified(false);
              }}
              placeholder="jazzmind"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repository Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={githubRepoName}
              onChange={(e) => {
                setGithubRepoName(e.target.value);
                setRepoVerified(false);
              }}
              placeholder="innovation"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={verifyRepository}
            disabled={verifying || !githubRepoOwner || !githubRepoName}
          >
            {verifying ? 'Verifying...' : 'Verify Repository Access'}
          </Button>
          
          {repoVerified && (
            <span className="text-green-600 text-sm">
              ✓ Repository access verified
            </span>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Branch
          </label>
          <input
            type="text"
            value={githubBranch}
            onChange={(e) => setGithubBranch(e.target.value)}
            placeholder="main"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      {/* Deployment Configuration */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900">Deployment Configuration</h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deploy Path (Server) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={deployPath}
            onChange={(e) => setDeployPath(e.target.value)}
            placeholder="/srv/apps/innovation"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Where the application files will be stored on the server
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            App Path (URL) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={appPath}
            onChange={(e) => {
              setAppPath(e.target.value);
              validateAppPath(e.target.value);
            }}
            placeholder="/innovation"
            required
            pattern="^\/[a-z0-9-_]+$"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              pathValid
                ? 'border-green-300 focus:ring-green-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {pathValid && (
            <p className="mt-1 text-xs text-green-600">
              ✓ Path is available
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            URL path where users will access the app (e.g., /innovation)
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Port <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="3003"
              required
              min="3003"
              max="3999"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Automatically assigned next available port
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Health Endpoint
            </label>
            <input
              type="text"
              value={healthEndpoint}
              onChange={(e) => setHealthEndpoint(e.target.value)}
              placeholder="/api/health"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Build Command
            </label>
            <input
              type="text"
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              placeholder="npm run build"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Command
            </label>
            <input
              type="text"
              value={startCommand}
              onChange={(e) => setStartCommand(e.target.value)}
              placeholder="npm start"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="stagingEnabled"
            checked={stagingEnabled}
            onChange={(e) => setStagingEnabled(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="stagingEnabled" className="text-sm text-gray-700">
            Enable staging environment (create test version at /apppath-stage/)
          </label>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}
        
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading || !repoVerified || !pathValid}
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </form>
  );
}

