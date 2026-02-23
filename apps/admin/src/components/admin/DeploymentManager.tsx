/**
 * Deployment Manager Component
 * Manages GitHub integration, releases, and deployments for an app
 */

'use client';

import { useState, useEffect } from 'react';
import { Button, StatusBadge } from '@jazzmind/busibox-app';
import { DeploymentConfigForm } from './DeploymentConfigForm';
import { SecretsManager } from './SecretsManager';
import { canConnectToGitHub } from '@jazzmind/busibox-app/lib/deploy/app-utils';

interface DeploymentManagerProps {
  appId: string;
  appName: string;
}

interface GitHubStatus {
  connected: boolean;
  expired?: boolean;
  username?: string;
  scopes?: string[];
  connectedAt?: string;
}

interface DeploymentConfig {
  id: string;
  githubRepoOwner: string;
  githubRepoName: string;
  githubBranch: string;
  deployPath: string;
  port: number;
  autoDeployEnabled?: boolean;
  stagingEnabled: boolean;
  deployments?: Array<{
    id: string;
    environment: string;
    status: string;
    releaseTag: string;
    startedAt: string;
    completedAt?: string;
  }>;
}

interface Release {
  id: string;
  tagName: string;
  releaseName: string | null;
  body: string | null;
  publishedAt: string;
  isPrerelease: boolean;
  isCurrentlyDeployed?: boolean;
}

export function DeploymentManager({ appId, appName }: DeploymentManagerProps) {
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [config, setConfig] = useState<DeploymentConfig | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState(false);
  
  // Check if this app can connect to GitHub
  const canUseGitHub = canConnectToGitHub(appName);
  
  useEffect(() => {
    loadData();
  }, [appId]);
  
  async function loadData() {
    setLoading(true);
    try {
      // Check GitHub connection status
      const statusRes = await fetch('/api/github/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setGithubStatus(statusData);
      }
      
      // Load deployment config
      const configsRes = await fetch('/api/deployments/config');
      if (configsRes.ok) {
        const { configs } = await configsRes.json();
        const appConfig = configs.find((c: any) => c.appId === appId);
        if (appConfig) {
          setConfig(appConfig);
          
          // Load releases
          const releasesRes = await fetch(`/api/deployments/releases/${appConfig.id}`);
          if (releasesRes.ok) {
            const { releases: releasesData } = await releasesRes.json();
            setReleases(releasesData);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load deployment data:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function connectGitHub() {
    try {
      const res = await fetch('/api/github/connect');
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('GitHub connect error:', errorData);
        alert(`Failed to connect: ${errorData.error || 'Unknown error'}`);
        return;
      }
      
      const { authUrl } = await res.json();
      
      if (!authUrl) {
        console.error('No authUrl returned from server');
        alert('Failed to get GitHub authorization URL');
        return;
      }
      
      console.log('Redirecting to GitHub OAuth:', authUrl);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to initiate GitHub connection:', error);
      alert('Failed to connect to GitHub: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
  
  async function reconnectGitHub() {
    if (!confirm('This will clear your current GitHub connection and redirect you to reconnect with updated permissions. Continue?')) {
      return;
    }
    
    try {
      const res = await fetch('/api/github/reconnect', {
        method: 'POST',
      });
      
      const data = await res.json();
      
      if (data.success && data.authUrl) {
        // Redirect to GitHub OAuth with fresh permissions
        window.location.href = data.authUrl;
      } else {
        alert(data.error || 'Failed to reconnect GitHub');
      }
    } catch (error) {
      console.error('Failed to reconnect GitHub:', error);
      alert('Failed to reconnect GitHub');
    }
  }
  
  async function syncReleases() {
    if (!config) return;
    
    setSyncing(true);
    try {
      const res = await fetch(`/api/deployments/releases/${config.id}/sync`, {
        method: 'POST',
      });
      
      if (res.ok) {
        const { releases: releasesData } = await res.json();
        setReleases(releasesData);
      } else {
        const error = await res.json();
        alert(`Failed to sync releases: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to sync releases:', error);
      alert('Failed to sync releases');
    } finally {
      setSyncing(false);
    }
  }
  
  async function deployRelease(
    releaseTag: string, 
    environment: 'PRODUCTION' | 'STAGING',
    deploymentType: 'RELEASE' | 'BRANCH' = 'RELEASE'
  ) {
    if (!config) return;
    
    const typeLabel = deploymentType === 'BRANCH' ? 'branch' : 'release';
    const confirmed = confirm(
      `Deploy ${releaseTag} (${typeLabel}) to ${environment}?\n\nThis will:\n` +
      `- Download the ${typeLabel} from GitHub\n` +
      `- Build and restart the application\n` +
      `- Run health checks\n\n` +
      `The current version will be backed up for rollback.`
    );
    
    if (!confirmed) return;
    
    setDeploying(releaseTag);
    try {
      const res = await fetch('/api/deployments/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: config.id,
          releaseTag,
          environment,
          deploymentType,
        }),
      });
      
      if (res.ok) {
        alert(`Deployment started for ${releaseTag} (${typeLabel})`);
        loadData(); // Reload to show deployment status
      } else {
        const error = await res.json();
        alert(`Failed to deploy: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to deploy:', error);
      alert('Failed to deploy');
    } finally {
      setDeploying(null);
    }
  }
  
  // Built-in apps cannot use GitHub deployment
  if (!canUseGitHub) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              GitHub Deployment Not Available
            </h3>
            <p className="text-sm text-yellow-800">
              {appName} is a built-in application and cannot be deployed via GitHub.
              Built-in apps are managed directly by the system.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading deployment configuration...</p>
      </div>
    );
  }
  
  // Not connected to GitHub
  if (!githubStatus?.connected) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="max-w-md mx-auto">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Connect GitHub</h3>
          <p className="mt-2 text-sm text-gray-600">
            Connect your GitHub account to enable deployment management for {appName}.
            You'll be able to:
          </p>
          <ul className="mt-4 text-sm text-gray-600 text-left space-y-2">
            <li>• Access private repositories</li>
            <li>• View and deploy releases</li>
            <li>• Manage deployment configurations</li>
            <li>• Configure secrets and environment variables</li>
          </ul>
          <Button onClick={connectGitHub} className="mt-6">
            Connect GitHub Account
          </Button>
        </div>
      </div>
    );
  }
  
  // No deployment config yet
  if (!config) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="max-w-3xl">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Configure Deployment for {appName}
          </h3>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">
                  Connected as <strong>{githubStatus.username}</strong>
                </p>
                {githubStatus.connectedAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Connected: {new Date(githubStatus.connectedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <Button
                onClick={reconnectGitHub}
                variant="secondary"
                size="sm"
              >
                Refresh GitHub Permissions
              </Button>
            </div>
            
            {/* Display current scopes */}
            {githubStatus.scopes && githubStatus.scopes.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Current GitHub Scopes:</p>
                <div className="flex flex-wrap gap-2">
                  {githubStatus.scopes.map((scope) => (
                    <span
                      key={scope}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        scope === 'repo' || scope.includes('contents')
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {scope}
                    </span>
                  ))}
                </div>
                {!githubStatus.scopes.some(s => s === 'repo' || s.includes('contents')) && (
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ Missing 'repo' or 'contents' scope - you may not be able to access repositories
                  </p>
                )}
              </div>
            )}
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> If you recently updated your GitHub App permissions (e.g., added "Contents" permission),
              click "Refresh GitHub Permissions" to reconnect with the new scopes.
            </p>
          </div>
          
          <DeploymentConfigForm
            appId={appId}
            appName={appName}
            onSuccess={loadData}
          />
        </div>
      </div>
    );
  }
  
  // Show deployment manager
  return (
    <div className="space-y-6">
      {/* Current Deployment Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Current Deployment</h3>
          <StatusBadge 
            status={config.deployments?.[0]?.status || 'Not Deployed'} 
            variant={config.deployments?.[0]?.status === 'COMPLETED' ? 'success' : 'warning'}
          />
        </div>
        
        {config.deployments?.[0] ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Version:</span>
              <span className="ml-2 font-medium">{config.deployments[0].releaseTag}</span>
            </div>
            <div>
              <span className="text-gray-600">Environment:</span>
              <span className="ml-2 font-medium">{config.deployments[0].environment}</span>
            </div>
            <div>
              <span className="text-gray-600">Deployed:</span>
              <span className="ml-2 font-medium">
                {new Date(config.deployments[0].startedAt).toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No deployments yet</p>
        )}
      </div>
      
      {/* Direct Branch Deployment */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Deploy from Branch</h3>
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Deploy directly from the <strong>{config.githubBranch}</strong> branch without creating a release.
            This is useful for testing and continuous deployment.
          </p>
        </div>
        <div className="flex gap-3">
          {config.stagingEnabled && (
            <Button
              onClick={() => deployRelease(config.githubBranch, 'STAGING', 'BRANCH')}
              disabled={deploying !== null}
              variant="secondary"
            >
              {deploying === config.githubBranch ? 'Deploying...' : `Deploy ${config.githubBranch} to Staging`}
            </Button>
          )}
          <Button
            onClick={() => deployRelease(config.githubBranch, 'PRODUCTION', 'BRANCH')}
            disabled={deploying !== null}
          >
            {deploying === config.githubBranch ? 'Deploying...' : `Deploy ${config.githubBranch} to Production`}
          </Button>
        </div>
      </div>
      
      {/* Releases */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Tagged Releases</h3>
          <Button 
            onClick={syncReleases} 
            disabled={syncing}
            variant="secondary"
            size="sm"
          >
            {syncing ? 'Syncing...' : 'Sync from GitHub'}
          </Button>
        </div>
        
        {releases.length === 0 ? (
          <p className="text-sm text-gray-600">
            No releases found. Click "Sync from GitHub" to fetch releases.
          </p>
        ) : (
          <div className="space-y-3">
            {releases.map(release => (
              <div 
                key={release.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{release.tagName}</h4>
                      {release.isCurrentlyDeployed && (
                        <StatusBadge status="Current" variant="success" />
                      )}
                      {release.isPrerelease && (
                        <StatusBadge status="Pre-release" variant="warning" />
                      )}
                    </div>
                    {release.releaseName && (
                      <p className="text-sm text-gray-600 mt-1">{release.releaseName}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Published {new Date(release.publishedAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    {config.stagingEnabled && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => deployRelease(release.tagName, 'STAGING')}
                        disabled={deploying !== null}
                      >
                        Deploy to Staging
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => deployRelease(release.tagName, 'PRODUCTION')}
                      disabled={deploying !== null || release.isCurrentlyDeployed}
                    >
                      {deploying === release.tagName ? 'Deploying...' : 'Deploy to Production'}
                    </Button>
                  </div>
                </div>
                
                {release.body && (
                  <details className="mt-3">
                    <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                      Release Notes
                    </summary>
                    <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                      {release.body}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Configuration</h3>
          <Button
            onClick={() => setEditingConfig(!editingConfig)}
            variant="secondary"
            size="sm"
          >
            {editingConfig ? 'Cancel' : 'Edit Configuration'}
          </Button>
        </div>
        
        {editingConfig ? (
          <DeploymentConfigForm
            appId={appId}
            appName={appName}
            existingConfig={config}
            onSuccess={() => {
              setEditingConfig(false);
              loadData();
            }}
            onCancel={() => setEditingConfig(false)}
          />
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-600">Repository</dt>
              <dd className="font-medium mt-1">
                {config.githubRepoOwner}/{config.githubRepoName}
              </dd>
            </div>
            <div>
              <dt className="text-gray-600">Branch</dt>
              <dd className="font-medium mt-1">{config.githubBranch}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Deploy Path</dt>
              <dd className="font-medium mt-1">{config.deployPath}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Port</dt>
              <dd className="font-medium mt-1">{config.port}</dd>
            </div>
            <div>
              <dt className="text-gray-600">Staging Enabled</dt>
              <dd className="font-medium mt-1">
                {config.stagingEnabled ? 'Yes' : 'No'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-600">Auto Deploy</dt>
              <dd className="font-medium mt-1">
                {config.autoDeployEnabled ? 'Yes' : 'No'}
              </dd>
            </div>
          </dl>
        )}
      </div>
      
      {/* Secrets Management */}
      <SecretsManager configId={config.id} />
    </div>
  );
}

