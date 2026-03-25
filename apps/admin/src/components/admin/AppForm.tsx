/**
 * AppForm Component
 * 
 * Form for registering and editing applications.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@jazzmind/busibox-app';
import { IconPicker } from './IconPicker';
import { isBuiltInApp, isLibraryApp } from '@jazzmind/busibox-app/lib/deploy/app-utils';
import { getLibraryAppByName } from '@jazzmind/busibox-app/lib/deploy/app-library';
import { apiUrl } from '@jazzmind/busibox-app/lib/next/api-url';
import type { AppType } from '@/types';
import type { IconName } from '@jazzmind/busibox-app';

type LastDeployment = {
  id: string;
  status: string | null;
  logs: string[];
  error: string | null;
  startedAt?: string;
  endedAt?: string;
};

type AppFormProps = {
  app?: {
    id: string;
    name: string;
    description: string | null;
    type: AppType;
    url: string | null;
    iconUrl: string | null;
    selectedIcon: IconName | null;
    displayOrder: number;
    isActive: boolean;
    healthEndpoint?: string | null;
    deployedPath?: string | null; // Deployed app path (for EXTERNAL apps)
    hasGithubToken?: boolean; // Indicates if a token is stored (token value never sent to client)
    lastDeployment?: LastDeployment; // Last deployment info for persistence
    // Version tracking
    deployedVersion?: string | null;
    latestVersion?: string | null;
    updateAvailable?: boolean;
    devMode?: boolean;
    primaryColor?: string | null;
    secondaryColor?: string | null;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function AppForm({ app, onSuccess, onCancel }: AppFormProps) {
  const router = useRouter();
  const isEditMode = !!app;
  
  // Check if type is pre-selected via query param
  const [searchParams] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });
  const preselectedType = searchParams.get('type') as AppType | null;

  const [name, setName] = useState(app?.name || '');
  const [description, setDescription] = useState(app?.description || '');
  const [type, setType] = useState<AppType>(app?.type || preselectedType || 'LIBRARY');
  const [url, setUrl] = useState(app?.url || (preselectedType === 'EXTERNAL' ? 'https://github.com/' : ''));
  const [githubToken, setGithubToken] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<IconName | undefined>(
    (app?.selectedIcon || app?.iconUrl) as IconName | undefined
  );
  const [isActive, setIsActive] = useState(app?.isActive ?? true);
  const [primaryColor, setPrimaryColor] = useState(app?.primaryColor || '');
  const [secondaryColor, setSecondaryColor] = useState(app?.secondaryColor || '');
  const [healthEndpoint, setHealthEndpoint] = useState(app?.healthEndpoint || '/api/health');
  const [deployedPath, setDeployedPath] = useState(app?.deployedPath || '');
  const [devMode, setDevMode] = useState(app?.devMode ?? false);
  // Source mode: 'github' for GitHub repos, 'local' for local dev directories
  const [sourceMode, setSourceMode] = useState<'github' | 'local'>(app?.devMode ? 'local' : 'github');
  // Local dev directory name (relative to DEV_APPS_DIR)
  // Initialize from existing URL if it's a local-dev:// URL
  const [localDevDir, setLocalDevDir] = useState(() => {
    if (app?.url?.startsWith('local-dev://')) {
      return app.url.replace('local-dev://', '');
    }
    return '';
  });
  const [localDevValidation, setLocalDevValidation] = useState<{ valid: boolean; manifest?: any; error?: string } | null>(null);
  const [validatingLocalDev, setValidatingLocalDev] = useState(false);
  const localDevValidationTimer = useRef<NodeJS.Timeout | null>(null);
  // Local dev apps list from deploy-api
  const [localDevApps, setLocalDevApps] = useState<Array<{ dirName: string; manifest: any }>>([]);
  const [localDevAppsDir, setLocalDevAppsDir] = useState<string>('');
  const [loadingLocalDevApps, setLoadingLocalDevApps] = useState(false);
  const [localDevAppsError, setLocalDevAppsError] = useState<string | null>(null);
  const [localDevSupported, setLocalDevSupported] = useState<boolean | null>(null);  // null = unknown, will be determined on fetch
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [createdAppId, setCreatedAppId] = useState<string | null>(null);
  const [pathValidation, setPathValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [validatingPath, setValidatingPath] = useState(false);
  const [manifestValidation, setManifestValidation] = useState<{ valid: boolean; manifest?: any; error?: string } | null>(null);
  const [validatingManifest, setValidatingManifest] = useState(false);
  // Initialize deployment state from last deployment if available
  const [deploymentId, setDeploymentId] = useState<string | null>(app?.lastDeployment?.id || null);
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>(app?.lastDeployment?.logs || []);
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(app?.lastDeployment?.status || null);
  const [showTokenInput, setShowTokenInput] = useState(!app?.hasGithubToken);
  const [storedTokenValid, setStoredTokenValid] = useState<boolean | null>(null);
  const [validatingStoredToken, setValidatingStoredToken] = useState(false);
  
  // Debounce timer refs
  const manifestValidationTimer = useRef<NodeJS.Timeout | null>(null);

  // Validate stored GitHub token on mount (for edit mode)
  useEffect(() => {
    if (isEditMode && app?.hasGithubToken && app?.url && type === 'EXTERNAL') {
      validateStoredToken();
    }
  }, []);

  // Track active EventSource for cleanup
  const eventSourceRef = useRef<EventSource | null>(null);

  // Resume streaming if deployment is still in progress on page load
  useEffect(() => {
    if (app?.lastDeployment?.id && app?.lastDeployment?.status) {
      const activeStatuses = ['pending', 'initiating', 'deploying', 'provisioning_db', 'configuring_nginx'];
      if (activeStatuses.includes(app.lastDeployment.status)) {
        // Resume SSE streaming for in-progress deployment
        streamDeploymentStatus(app.lastDeployment.id);
      }
    }
    
    // Cleanup EventSource on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Fetch available local dev apps when switching to local mode
  const fetchLocalDevApps = async () => {
    setLoadingLocalDevApps(true);
    setLocalDevAppsError(null);
    
    try {
      const res = await fetch('/api/apps/local-dev-apps');
      const data = await res.json();
      
      // Update whether local dev is supported
      setLocalDevSupported(data.localDevSupported ?? false);
      
      if (data.error) {
        setLocalDevAppsError(data.error);
        setLocalDevApps([]);
      } else {
        setLocalDevApps(data.apps || []);
        setLocalDevAppsDir(data.devAppsDir || '');
      }
    } catch (error) {
      console.error('Failed to fetch local dev apps:', error);
      setLocalDevAppsError('Failed to load available apps');
      setLocalDevApps([]);
      setLocalDevSupported(false);
    } finally {
      setLoadingLocalDevApps(false);
    }
  };

  // Fetch local dev apps info on mount and when source mode changes to 'local'
  useEffect(() => {
    // Check if local dev is supported when component mounts for EXTERNAL apps
    if ((type === 'EXTERNAL' || app?.type === 'EXTERNAL') && localDevSupported === null) {
      fetchLocalDevApps();
    }
  }, [type, app?.type]);
  
  // Fetch local dev apps when source mode changes to 'local'
  useEffect(() => {
    if (sourceMode === 'local' && (type === 'EXTERNAL' || app?.type === 'EXTERNAL')) {
      fetchLocalDevApps();
    }
  }, [sourceMode, type]);

  const validateStoredToken = async () => {
    if (!app?.url || !app?.id) return;
    
    setValidatingStoredToken(true);
    try {
      // Try to fetch manifest with stored token to validate it
      const response = await fetch('/api/apps/validate-manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubUrl: app.url,
          useStoredToken: true,
          appId: app.id,
        }),
      });

      const data = await response.json();
      setStoredTokenValid(data.valid === true);
    } catch (error) {
      console.error('Token validation error:', error);
      setStoredTokenValid(false);
    } finally {
      setValidatingStoredToken(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const apiUrl = isEditMode 
        ? `/api/apps/${app.id}`
        : '/api/apps';
      
      const method = isEditMode ? 'PATCH' : 'POST';
      
      const body: any = {
        name,
        description: description || null,
        selectedIcon: selectedIcon || null,
        isActive,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        healthEndpoint,
        deployedPath: type === 'EXTERNAL' ? deployedPath : null,
      };

      // Only include type and url for create
      if (!isEditMode) {
        body.type = type;
        
        // For local dev mode, construct the local-dev:// URL
        if (type === 'EXTERNAL' && sourceMode === 'local') {
          body.url = `local-dev://${localDevDir}`;
          body.devMode = true;
          // Include the manifest for local dev deployment
          if (localDevValidation?.manifest) {
            body.manifest = localDevValidation.manifest;
          }
        } else {
          body.url = url || null;
        }
        
        // Include GitHub token for external apps (GitHub mode only)
        if (type === 'EXTERNAL' && sourceMode === 'github') {
          body.githubToken = githubToken || null;
        }
      } else if (app.type === 'EXTERNAL') {
        // For local dev mode, construct the local-dev:// URL
        if (sourceMode === 'local') {
          body.url = `local-dev://${localDevDir}`;
          body.devMode = true;
        } else {
          body.url = url || null;
          body.devMode = false;
          // Only send token if we're showing the input (user is updating it)
          if (showTokenInput) {
            body.githubToken = githubToken || null;
          }
        }
      }

      const response = await fetch(apiUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        // For new external apps, save the client secret
        if (!isEditMode && type === 'EXTERNAL' && data.data.app.oauthClientSecret) {
          setClientSecret(data.data.app.oauthClientSecret);
          setCreatedAppId(data.data.app.id || null);
        } else {
          if (onSuccess) {
            onSuccess();
          } else {
            // Redirect to the app detail page so user can finish configuring
            const appId = data.data?.app?.id;
            router.push(appId ? `/apps/${appId}` : '/apps');
            router.refresh();
          }
        }
      } else {
        setError(data.error || 'An error occurred');
      }
    } catch (err) {
      console.error('Form submission error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!app) return;
    
    setLoading(true);
    setError('');
    setDeploymentLogs([]);
    setDeploymentStatus('initiating');

    try {
      // Step 1: Save any pending changes first
      setDeploymentLogs(['📝 Saving configuration changes...']);
      
      const saveBody: any = {
        name,
        description: description || null,
        selectedIcon: selectedIcon || null,
        isActive,
        healthEndpoint,
        deployedPath: deployedPath || null,
      };

      // For external apps, include URL and token if applicable
      if (app.type === 'EXTERNAL') {
        // For local dev mode, construct the local-dev:// URL
        if (sourceMode === 'local') {
          saveBody.url = `local-dev://${localDevDir}`;
          saveBody.devMode = true;
        } else {
          saveBody.url = url || null;
          saveBody.devMode = false;
          if (showTokenInput) {
            saveBody.githubToken = githubToken || null;
          }
        }
      }

      const saveResponse = await fetch(`/api/apps/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveBody),
      });

      const saveData = await saveResponse.json();

      if (!saveData.success) {
        setError(saveData.error || 'Failed to save changes');
        setDeploymentStatus('failed');
        setDeploymentLogs(prev => [...prev, `❌ Save failed: ${saveData.error}`]);
        setLoading(false);
        return;
      }

      setDeploymentLogs(prev => [...prev, '✓ Configuration saved']);

      // Step 2: Trigger deployment
      setDeploymentLogs(prev => [...prev, '🚀 Initiating deployment...']);
      
      const response = await fetch(`/api/apps/${app.id}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubToken: githubToken || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const newDeploymentId = data.data.deploymentId;
        setDeploymentId(newDeploymentId);
        setDeploymentStatus('deploying');
        setDeploymentLogs(prev => [...prev, `✓ Deployment initiated: ${newDeploymentId}`]);
        
        // Start SSE streaming for real-time deployment status
        streamDeploymentStatus(newDeploymentId);
      } else {
        setError(data.error || 'Deployment failed');
        setDeploymentStatus('failed');
        setDeploymentLogs(prev => [...prev, `❌ Error: ${data.error}`]);
        setLoading(false);
      }
    } catch (err) {
      console.error('Deployment error:', err);
      setError('Failed to trigger deployment');
      setDeploymentStatus('failed');
      setDeploymentLogs(prev => [...prev, `❌ Failed to trigger deployment: ${err}`]);
      setLoading(false);
    }
  };

  /**
   * Stream deployment status using Server-Sent Events (SSE)
   * Much more efficient than polling - receives updates in real-time
   */
  const streamDeploymentStatus = (deploymentIdToStream: string) => {
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const streamUrl = apiUrl(`/api/apps/${app?.id}/deploy/${deploymentIdToStream}/stream`);
    let retryCount = 0;
    const maxRetries = 30; // Max 30 retries (with 2s delay = 60s total)
    let allLogs: string[] = [];
    let hasReceivedData = false;
    
    const connectToStream = () => {
      console.log('[Deployment] Starting SSE stream for', deploymentIdToStream, `(attempt ${retryCount + 1})`);
      
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Check for "Deployment not found" error - this means deployment hasn't registered yet
          if (data.error === 'Deployment not found') {
            console.log('[Deployment] Deployment not yet registered, will retry...');
            eventSource.close();
            eventSourceRef.current = null;
            
            retryCount++;
            if (retryCount < maxRetries) {
              // Wait and retry
              setTimeout(connectToStream, 2000);
            } else {
              // Fall back to polling after max retries
              console.log('[Deployment] Max SSE retries reached, falling back to polling');
              pollDeploymentStatus(deploymentIdToStream);
            }
            return;
          }
          
          hasReceivedData = true;
          
          // Handle incremental logs (append new logs)
          if (data.logs && data.logs.length > 0) {
            // If this is incremental (not all logs), append
            if (data.totalLogs && data.totalLogs > allLogs.length) {
              allLogs = [...allLogs, ...data.logs];
            } else {
              // Full logs update
              allLogs = data.logs;
            }
            setDeploymentLogs([...allLogs]);
          }
          
          // Update status
          if (data.status) {
            setDeploymentStatus(data.status);
          }
          
          // Handle completion
          if (data.status === 'completed') {
            setDeploymentLogs(prev => [...prev, '✅ Deployment completed successfully!']);
            setLoading(false);
            eventSource.close();
            eventSourceRef.current = null;
          }
          
          // Handle failure
          if (data.status === 'failed') {
            setError(data.error || 'Deployment failed');
            setDeploymentLogs(prev => [...prev, `❌ ${data.error || 'Deployment failed'}`]);
            setLoading(false);
            eventSource.close();
            eventSourceRef.current = null;
          }
        } catch (parseError) {
          console.error('[Deployment] Error parsing SSE data:', parseError);
        }
      };
      
      // Handle the 'complete' event (final status)
      eventSource.addEventListener('complete', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          hasReceivedData = true;
          
          // Update with all logs on completion
          if (data.logs) {
            setDeploymentLogs(data.logs);
          }
          
          if (data.status === 'completed') {
            setDeploymentLogs(prev => [...prev, '✅ Deployment completed successfully!']);
          } else if (data.status === 'failed') {
            setError(data.error || 'Deployment failed');
            setDeploymentLogs(prev => [...prev, `❌ ${data.error || 'Deployment failed'}`]);
          }
          
          setLoading(false);
          eventSource.close();
          eventSourceRef.current = null;
        } catch (parseError) {
          console.error('[Deployment] Error parsing complete event:', parseError);
        }
      });
      
      // Handle custom error events from server
      eventSource.addEventListener('error', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          
          // "Deployment not found" is handled as a retry case, not a real error
          if (data.error === 'Deployment not found') {
            return; // Already handled in onmessage
          }
          
          console.error('[Deployment] SSE error event:', data);
          setError(data.error || 'Stream error');
          setDeploymentLogs(prev => [...prev, `❌ Stream error: ${data.error || 'Unknown error'}`]);
          setLoading(false);
          eventSource.close();
          eventSourceRef.current = null;
        } catch {
          // Generic error (connection issue) - let onerror handle it
        }
      });
      
      // Handle connection errors
      eventSource.onerror = () => {
        // Check if the stream was intentionally closed
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('[Deployment] Stream closed');
          return;
        }
        
        // If we haven't received any data yet, this might be a connection issue
        // Close and retry manually instead of letting EventSource auto-reconnect
        if (!hasReceivedData) {
          console.log('[Deployment] Connection error before receiving data');
          eventSource.close();
          eventSourceRef.current = null;
          
          retryCount++;
          if (retryCount < maxRetries) {
            setTimeout(connectToStream, 2000);
          } else {
            console.log('[Deployment] Max retries reached, falling back to polling');
            pollDeploymentStatus(deploymentIdToStream);
          }
        }
        // If we have received data, let EventSource try to reconnect automatically
      };
    };
    
    // Start connection after a small delay to let deployment register
    setTimeout(connectToStream, 1500);
  };

  /**
   * Fallback to polling if SSE is not available
   * Kept for backwards compatibility
   */
  const pollDeploymentStatus = async (deploymentIdToPoll: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (5 second intervals)
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/apps/${app?.id}/deploy/${deploymentIdToPoll}/status`);
        
        if (!response.ok) {
          if (attempts < 3) {
            attempts++;
            setTimeout(poll, 2000);
            return;
          }
          throw new Error('Failed to fetch deployment status');
        }
        
        const status = await response.json();
        
        if (status.logs && status.logs.length > 0) {
          setDeploymentLogs(status.logs);
        }
        
        setDeploymentStatus(status.status);
        
        if (status.status === 'completed') {
          setDeploymentLogs(prev => [...prev, '✅ Deployment completed successfully!']);
          setLoading(false);
          return;
        }
        
        if (status.status === 'failed') {
          setError(status.error || 'Deployment failed');
          setDeploymentLogs(prev => [...prev, `❌ ${status.error || 'Deployment failed'}`]);
          setLoading(false);
          return;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          setError('Deployment timed out - check logs for details');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error polling deployment status:', err);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          setError('Failed to get deployment status');
          setLoading(false);
        }
      }
    };
    
    setTimeout(poll, 2000);
  };

  const [undeploying, setUndeploying] = useState(false);
  const [showUndeployConfirm, setShowUndeployConfirm] = useState(false);

  const handleUndeploy = async () => {
    if (!app) return;
    
    // Close the modal immediately when starting undeploy
    setShowUndeployConfirm(false);
    
    setUndeploying(true);
    setError('');
    setDeploymentLogs([]);
    setDeploymentStatus('undeploying');

    try {
      setDeploymentLogs(['🗑️ Starting undeploy...']);
      
      const response = await fetch(`/api/apps/${app.id}/undeploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          removeVolumes: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDeploymentStatus('undeployed');
        setDeploymentLogs(data.data?.logs || ['✅ Undeploy completed successfully!']);
      } else {
        setError(data.error || 'Undeploy failed');
        setDeploymentStatus('undeploy_failed');
        setDeploymentLogs(data.data?.logs || [`❌ Error: ${data.error}`]);
      }
    } catch (err) {
      console.error('Undeploy error:', err);
      setError('Failed to undeploy app');
      setDeploymentStatus('undeploy_failed');
      setDeploymentLogs([`❌ Failed to undeploy: ${err}`]);
    } finally {
      setUndeploying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Client secret copied to clipboard!');
  };

  // Validate path for LIBRARY apps
  const validatePath = async (path: string) => {
    if (!path || type !== 'LIBRARY') {
      setPathValidation(null);
      return;
    }

    setValidatingPath(true);
    try {
      const res = await fetch(`/api/deployments/config/helpers?action=validate-path&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setPathValidation(data);
    } catch (error) {
      console.error('Path validation error:', error);
      setPathValidation({ valid: false, error: 'Failed to validate path' });
    } finally {
      setValidatingPath(false);
    }
  };

  // Validate GitHub manifest for EXTERNAL apps
  const validateManifestFromGitHub = async (repoUrl: string) => {
    if (!repoUrl || type !== 'EXTERNAL') {
      setManifestValidation(null);
      return;
    }

    setValidatingManifest(true);
    try {
      const res = await fetch('/api/apps/validate-manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: repoUrl, githubToken }),
      });
      const data = await res.json();
      setManifestValidation(data);
      
      // Auto-fill form fields from manifest if valid
      if (data.valid && data.manifest) {
        setName(data.manifest.name);
        setDescription(data.manifest.description);
        setSelectedIcon(data.manifest.icon);
        setHealthEndpoint(data.manifest.healthEndpoint);
        setDeployedPath(data.manifest.defaultPath);
      }
    } catch (error) {
      console.error('Manifest validation error:', error);
      setManifestValidation({ valid: false, error: 'Failed to validate manifest' });
    } finally {
      setValidatingManifest(false);
    }
  };

  // Validate local dev directory for EXTERNAL apps in local dev mode
  const validateLocalDevDir = async (dirName: string) => {
    if (!dirName || type !== 'EXTERNAL') {
      setLocalDevValidation(null);
      return;
    }

    setValidatingLocalDev(true);
    try {
      const res = await fetch('/api/apps/validate-local-dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirName }),
      });
      const data = await res.json();
      setLocalDevValidation(data);
      
      // Auto-fill form fields from manifest if valid
      if (data.valid && data.manifest) {
        setName(data.manifest.name);
        setDescription(data.manifest.description);
        setSelectedIcon(data.manifest.icon);
        setHealthEndpoint(data.manifest.healthEndpoint);
        setDeployedPath(data.manifest.defaultPath);
        // For local dev, we still set a placeholder URL with the directory name
        setUrl(`local-dev://${dirName}`);
      }
    } catch (error) {
      console.error('Local dev validation error:', error);
      setLocalDevValidation({ valid: false, error: 'Failed to validate local directory' });
    } finally {
      setValidatingLocalDev(false);
    }
  };

  // Debounce path validation
  const handlePathChange = (newPath: string) => {
    setUrl(newPath);
    
    if (type === 'LIBRARY') {
      // Clear previous validation
      setPathValidation(null);
      
      // Validate after a short delay
      const timer = setTimeout(() => {
        validatePath(newPath);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  };

  // If client secret is shown, display success message
  if (clientSecret) {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            ✅ App Registered Successfully!
          </h3>
          <p className="text-green-700 mb-4">
            Save this OAuth client secret - it will not be shown again!
          </p>
          
          <div className="bg-white border border-green-300 rounded p-4 font-mono text-sm break-all">
            {clientSecret}
          </div>
          
          <div className="flex gap-3 mt-4">
            <Button
              variant="primary"
              onClick={() => copyToClipboard(clientSecret)}
            >
              📋 Copy to Clipboard
            </Button>
            
            <Button
              variant="secondary"
              onClick={() => {
                router.push(createdAppId ? `/apps/${createdAppId}` : '/apps');
                router.refresh();
              }}
            >
              Continue to App Settings
            </Button>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
            How to use this secret:
          </h4>
          <ol className="text-sm text-blue-700 dark:text-blue-300 list-decimal list-inside space-y-1">
            <li>Save the client secret in your external app's environment variables</li>
            <li>When validating SSO tokens, send this secret to /api/sso/validate</li>
            <li>Never expose this secret in client-side code</li>
          </ol>
        </div>
      </div>
    );
  }

  const isBuiltIn = isEditMode && app ? isBuiltInApp(app.name) : false;
  const isLibrary = isEditMode && app ? isLibraryApp(app.name) : false;
  const libraryConfig = isLibrary && app ? getLibraryAppByName(app.name) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Built-in App Notice */}
      {isBuiltIn && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">
                Built-in Application
              </h4>
              <p className="text-sm text-blue-800">
                This is a built-in application. Core system apps that are automatically managed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Library App Notice */}
      {isLibrary && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📚</span>
            <div>
              <h4 className="text-sm font-semibold text-purple-900 mb-1">
                Library Application
              </h4>
              <p className="text-sm text-purple-800">
                This app is from the library. Path and health endpoint are managed by the app configuration.
              </p>
              {libraryConfig && (
                <div className="mt-2 text-xs text-purple-700 space-y-1">
                  <div><strong>Path:</strong> <code className="bg-purple-100 px-1 py-0.5 rounded">{libraryConfig.defaultPath}</code></div>
                  <div><strong>Port:</strong> <code className="bg-purple-100 px-1 py-0.5 rounded">{libraryConfig.defaultPort}</code></div>
                  <div><strong>Repository:</strong> <code className="bg-purple-100 px-1 py-0.5 rounded">{libraryConfig.githubRepo}</code></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Name */}
      <Input
        label="Application Name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., myGPT, Media Generator"
        required
        autoFocus={!isEditMode}
      />

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description (Optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this application does..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Type (only for create and not preselected) */}
      {!isEditMode && !preselectedType && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AppType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="LIBRARY">Library App</option>
            <option value="EXTERNAL">External App (GitHub)</option>
          </select>
          <div className="mt-2 text-sm text-gray-600 space-y-2">
            {type === 'LIBRARY' && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <p className="font-medium text-blue-900 dark:text-blue-200 mb-1">📚 Library App</p>
                <p className="text-blue-800 dark:text-blue-200">
                  Select from pre-configured apps (Doc Intel, Data Visualizer, etc.) that are deployed 
                  alongside the Busibox Portal. These apps run on separate ports and are served via nginx 
                  proxy on subdirectories of the same domain.
                </p>
              </div>
            )}
            {type === 'EXTERNAL' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="font-medium text-purple-700 mb-1">🌐 External App (GitHub)</p>
                <p className="text-purple-600">
                  Deploy a Busibox-compatible app from GitHub. The deployment service will clone the repo, 
                  read the busibox.json manifest, provision the database, and deploy via Ansible.
                </p>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Note: Built-in apps (Media Generator, AI Chat, Document Manager) are automatically registered 
            and cannot be created manually.
          </p>
        </div>
      )}
      
      {/* Source Mode Toggle (for EXTERNAL apps - only shown if local dev is supported) */}
      {(type === 'EXTERNAL' || app?.type === 'EXTERNAL') && localDevSupported && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Development Mode
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={sourceMode === 'local'}
              onClick={() => {
                if (sourceMode === 'github') {
                  setSourceMode('local');
                  setDevMode(true);
                  setManifestValidation(null);
                } else {
                  setSourceMode('github');
                  setDevMode(false);
                  setLocalDevValidation(null);
                }
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                sourceMode === 'local' ? 'bg-purple-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  sourceMode === 'local' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {sourceMode === 'github' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-medium text-blue-900 mb-2">🌐 GitHub Repository</p>
              <p className="text-sm text-blue-700">
                {isEditMode 
                  ? 'App deploys from GitHub repository. Toggle to switch to local development mode.'
                  : 'Clone and deploy from a GitHub repository. The system will fetch the busibox.json manifest, provision the database, and deploy automatically.'}
              </p>
            </div>
          ) : (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="font-medium text-purple-900 mb-2">💻 Local Development</p>
              <p className="text-sm text-purple-700">
                {isEditMode
                  ? 'App uses local source from DEV_APPS_DIR for development with hot-reload. Toggle to switch back to GitHub mode.'
                  : 'Use local source code for development with hot-reload. Your app directory is mounted from your DEV_APPS_DIR, allowing you to edit code locally and see changes immediately.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* GitHub Token for EXTERNAL apps (only when not in local dev mode) */}
      {type === 'EXTERNAL' && sourceMode === 'github' && (
        <div>
          {/* Show token status if stored and not editing */}
          {isEditMode && !showTokenInput && app?.hasGithubToken && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                GitHub Token
              </label>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                {validatingStoredToken ? (
                  <span className="text-sm text-gray-600">
                    <span className="inline-block animate-spin mr-2">⟳</span>
                    Validating stored token...
                  </span>
                ) : storedTokenValid === true ? (
                  <>
                    <span className="text-sm text-green-700 flex items-center">
                      <span className="mr-2">✓</span>
                      Valid token stored
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowTokenInput(true)}
                    >
                      Update Token
                    </Button>
                  </>
                ) : storedTokenValid === false ? (
                  <>
                    <span className="text-sm text-red-700 flex items-center">
                      <span className="mr-2">⚠️</span>
                      Stored token is invalid or expired
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowTokenInput(true)}
                    >
                      Update Token
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          )}
          
          {/* Show token input if creating or user clicked "Update Token" or no token stored */}
          {(!isEditMode || showTokenInput) && (
            <Input
              label="GitHub Token (Optional)"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_..."
              helperText={isEditMode 
                ? "Provide token for private repos or leave empty to use vault default. Used when clicking Deploy button."
                : "Leave empty to use default token from vault. Required for private repositories."}
            />
          )}
        </div>
      )}

      {/* GitHub Repository URL (when sourceMode is 'github') */}
      {(type === 'EXTERNAL' || app?.type === 'EXTERNAL') && sourceMode === 'github' && (
        <div>
          <Input
            label="GitHub Repository URL"
            type="url"
            value={url}
            onChange={(e) => {
              const newUrl = e.target.value;
              setUrl(newUrl);
              
              // Clear existing timer
              if (manifestValidationTimer.current) {
                clearTimeout(manifestValidationTimer.current);
              }
              
              // Debounce manifest validation (1 second)
              manifestValidationTimer.current = setTimeout(() => {
                validateManifestFromGitHub(newUrl);
              }, 1000);
            }}
            placeholder="https://github.com/username/repo or https://github.com/username/repo.git"
            required={!isEditMode && type === 'EXTERNAL' && sourceMode === 'github'}
            helperText="Public or private GitHub repository URL. For private repos, ensure GitHub token is configured in vault."
          />
          {!isEditMode && validatingManifest && (
            <p className="mt-1 text-sm text-gray-500">
              🔄 Validating repository and fetching manifest...
            </p>
          )}
          {!isEditMode && manifestValidation?.valid === true && (
            <p className="mt-1 text-sm text-green-600">
              ✓ Found valid busibox.json manifest
            </p>
          )}
          {!isEditMode && manifestValidation?.valid === false && (
            <p className="mt-1 text-sm text-red-600">
              {manifestValidation.error}
            </p>
          )}
        </div>
      )}

      {/* Local Development Directory (when sourceMode is 'local') */}
      {(type === 'EXTERNAL' || app?.type === 'EXTERNAL') && sourceMode === 'local' && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 space-y-4">
          {/* Show DEV_APPS_DIR path */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-purple-700 dark:text-purple-300">DEV_APPS_DIR:</span>
            {loadingLocalDevApps ? (
              <span className="text-gray-500">Loading...</span>
            ) : localDevAppsDir ? (
              <code className="bg-purple-100 dark:bg-purple-800 px-2 py-0.5 rounded text-purple-800 dark:text-purple-200">
                {localDevAppsDir}
              </code>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">Not configured</span>
            )}
            <button
              type="button"
              onClick={fetchLocalDevApps}
              className="ml-auto text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 text-xs"
              title="Refresh app list"
            >
              ↻ Refresh
            </button>
          </div>
          
          {/* Error message */}
          {localDevAppsError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{localDevAppsError}</p>
            </div>
          )}
          
          {/* App selection dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Application <span className="text-red-500">*</span>
            </label>
            {loadingLocalDevApps ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                Loading available apps...
              </div>
            ) : localDevApps.length > 0 ? (
              <select
                value={localDevDir}
                onChange={(e) => {
                  const dir = e.target.value;
                  setLocalDevDir(dir);
                  
                  // Find the selected app's manifest
                  const selectedApp = localDevApps.find(a => a.dirName === dir);
                  if (selectedApp) {
                    // Auto-fill form fields from manifest
                    setLocalDevValidation({ valid: true, manifest: selectedApp.manifest });
                    setName(selectedApp.manifest.name);
                    setDescription(selectedApp.manifest.description || '');
                    setSelectedIcon(selectedApp.manifest.icon);
                    setHealthEndpoint(selectedApp.manifest.healthEndpoint);
                    setDeployedPath(selectedApp.manifest.defaultPath);
                    setUrl(`local-dev://${dir}`);
                  } else {
                    setLocalDevValidation(null);
                  }
                }}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:border-purple-500 dark:bg-gray-800 dark:text-white ${
                  localDevValidation?.valid === true
                    ? 'border-green-300 focus:ring-green-500'
                    : 'border-gray-300 focus:ring-purple-500'
                }`}
              >
                <option value="">Select an app...</option>
                {localDevApps.map((app) => (
                  <option key={app.dirName} value={app.dirName}>
                    {app.manifest.name} ({app.dirName}) - v{app.manifest.version}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full px-3 py-2 border border-amber-300 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm">
                No apps with valid busibox.json found in DEV_APPS_DIR
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Select from directories in DEV_APPS_DIR that contain a valid busibox.json manifest
            </p>
          </div>
          
          {/* Selected app manifest details */}
          {localDevValidation?.valid === true && localDevValidation.manifest && (
            <div className="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 rounded p-3">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Valid busibox.json manifest</p>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p><strong>Name:</strong> {localDevValidation.manifest.name}</p>
                <p><strong>ID:</strong> {localDevValidation.manifest.id}</p>
                <p><strong>Path:</strong> {localDevValidation.manifest.defaultPath}</p>
                {localDevValidation.manifest.appMode === 'custom' ? (
                  <p><strong>Mode:</strong> Custom Service ({localDevValidation.manifest.services?.length || 0} endpoints)</p>
                ) : (
                  <p><strong>Port:</strong> {localDevValidation.manifest.defaultPort}</p>
                )}
                {localDevValidation.manifest.description && (
                  <p><strong>Description:</strong> {localDevValidation.manifest.description}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Setup instructions when no apps available */}
          {!loadingLocalDevApps && localDevApps.length === 0 && !localDevAppsError && (
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p className="font-medium">Setup:</p>
              <ol className="list-decimal list-inside space-y-1 pl-2">
                <li>Set <code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">DEV_APPS_DIR</code> in your <code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">.env.local</code></li>
                <li>Ensure your app directory contains a valid <code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">busibox.json</code> manifest</li>
                <li>Run <code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">make docker-up</code> to mount the directory</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Path for LIBRARY apps (read-only when editing) */}
      {(type === 'LIBRARY' || app?.type === 'LIBRARY') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Application Path {!isEditMode && <span className="text-red-500">*</span>}
          </label>
          {isEditMode ? (
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
              <code>{url}</code>
            </div>
          ) : (
            <input
              type="text"
              value={url}
              onChange={(e) => handlePathChange(e.target.value)}
              placeholder="/dataviz"
              required
              pattern="^\/[a-z0-9-_]+$"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:border-blue-500 ${
                pathValidation?.valid === false
                  ? 'border-red-300 focus:ring-red-500'
                  : pathValidation?.valid === true
                  ? 'border-green-300 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
          )}
          {!isEditMode && validatingPath && (
            <p className="mt-1 text-sm text-gray-500">
              Validating path...
            </p>
          )}
          {!isEditMode && pathValidation?.valid === true && (
            <p className="mt-1 text-sm text-green-600">
              ✓ Path is available
            </p>
          )}
          {!isEditMode && pathValidation?.valid === false && (
            <p className="mt-1 text-sm text-red-600">
              {pathValidation.error}
            </p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            {isEditMode 
              ? 'Path is set by the library configuration and cannot be changed.'
              : 'Path must start with / and contain only lowercase letters, numbers, hyphens, and underscores.'}
          </p>
        </div>
      )}

      {/* Icon Picker */}
      <IconPicker
        label="Application Icon"
        value={selectedIcon}
        onChange={setSelectedIcon}
      />

      {/* Color Pickers */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primary Color <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor || '#3B82F6'}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-12 rounded border border-gray-300 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#3B82F6"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
            {primaryColor && (
              <button
                type="button"
                onClick={() => setPrimaryColor('')}
                className="text-gray-400 hover:text-gray-600 text-sm"
                title="Clear"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Secondary Color <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={secondaryColor || '#8B5CF6'}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-9 w-12 rounded border border-gray-300 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              placeholder="#8B5CF6"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
            {secondaryColor && (
              <button
                type="button"
                onClick={() => setSecondaryColor('')}
                className="text-gray-400 hover:text-gray-600 text-sm"
                title="Clear"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Health Endpoint (for LIBRARY and BUILT_IN apps) */}
      {((type === 'LIBRARY' || type === 'BUILT_IN') || (app?.type === 'LIBRARY' || app?.type === 'BUILT_IN')) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Health Check Endpoint
          </label>
          {isLibrary ? (
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
              <code>{healthEndpoint}</code>
            </div>
          ) : (
            <input
              type="text"
              value={healthEndpoint}
              onChange={(e) => setHealthEndpoint(e.target.value)}
              placeholder="/api/health"
              pattern="^\/.*"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          )}
          <p className="mt-1 text-sm text-gray-500">
            {isLibrary 
              ? 'Health endpoint is set by the library configuration and cannot be changed.'
              : 'Path to the health check endpoint for this application. Must start with /'}
          </p>
        </div>
      )}

      {/* Deployed Path and Health Endpoint (for EXTERNAL apps) */}
      {type === 'EXTERNAL' && isEditMode && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deployed Path
            </label>
            <input
              type="text"
              value={deployedPath}
              onChange={(e) => setDeployedPath(e.target.value)}
              placeholder="/my-app"
              pattern="^\/.*"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              The URL path where this app is deployed (e.g., /my-app). Set from manifest on first deploy, can be changed if there are path conflicts.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Health Check Endpoint
            </label>
            <input
              type="text"
              value={healthEndpoint}
              onChange={(e) => setHealthEndpoint(e.target.value)}
              placeholder="/api/health"
              pattern="^\/.*"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Path to the health check endpoint (appended to deployed path). Set from manifest.
            </p>
          </div>
        </>
      )}

      {/* Custom Service Details (shown when manifest indicates appMode: "custom") */}
      {(manifestValidation?.manifest?.appMode === 'custom' || localDevValidation?.manifest?.appMode === 'custom') && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-lg">🐳</span>
            <div>
              <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Custom Service</h4>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                This app runs as an isolated Docker Compose stack with its own containers.
              </p>
            </div>
          </div>

          {(() => {
            const m = manifestValidation?.manifest || localDevValidation?.manifest;
            if (!m) return null;
            return (
              <>
                {m.services && m.services.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300 mb-1">Service Endpoints:</p>
                    <div className="space-y-1">
                      {m.services.map((svc: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-700 rounded px-2 py-1">
                          <span className="font-mono font-medium text-indigo-700 dark:text-indigo-300">{svc.name}</span>
                          <span className="text-gray-400">→</span>
                          <code className="text-gray-600 dark:text-gray-400">{svc.path}:{svc.port}</code>
                          <span className="text-gray-400 ml-auto">health: {svc.healthEndpoint || '/health'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {m.runtime && (
                  <div className="text-xs text-indigo-700 dark:text-indigo-300">
                    <strong>Runtime:</strong> {m.runtime.type || 'docker-compose'} &middot; <strong>Compose:</strong> {m.runtime.composeFile || 'docker-compose.yml'}
                  </div>
                )}
                {m.auth && (
                  <div className="text-xs text-indigo-700 dark:text-indigo-300">
                    <strong>Auth audience:</strong> <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">{m.auth.audience}</code>
                    {m.auth.scopes?.length > 0 && <> &middot; <strong>Scopes:</strong> {m.auth.scopes.join(', ')}</>}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Version Info (for deployed EXTERNAL apps) */}
      {type === 'EXTERNAL' && isEditMode && app?.deployedVersion && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Deployed Version: </span>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{app.deployedVersion}</code>
            </div>
            {app.updateAvailable && app.latestVersion && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  Update Available: {app.latestVersion}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Toggle */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
          Active (visible to users)
        </label>
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
        
        {/* Deploy/Redeploy button for existing external apps */}
        {isEditMode && app.type === 'EXTERNAL' && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleDeploy}
            loading={loading}
            disabled={loading || undeploying}
          >
            🚀 {loading ? 'Deploying...' : 'Deploy'}
          </Button>
        )}
        
        {/* Undeploy button for existing external apps */}
        {isEditMode && app.type === 'EXTERNAL' && (
          <Button
            type="button"
            variant="danger"
            onClick={() => setShowUndeployConfirm(true)}
            loading={undeploying}
            disabled={loading || undeploying}
          >
            🗑️ {undeploying ? 'Undeploying...' : 'Undeploy'}
          </Button>
        )}
        
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading || !name || 
            (type === 'LIBRARY' && !isEditMode && pathValidation?.valid !== true) ||
            (type === 'EXTERNAL' && !isEditMode && sourceMode === 'github' && manifestValidation?.valid !== true) ||
            (type === 'EXTERNAL' && !isEditMode && sourceMode === 'local' && localDevValidation?.valid !== true)}
        >
          {loading 
            ? (isEditMode ? 'Updating...' : 'Registering...') 
            : (isEditMode ? 'Update App' : 'Register App')}
        </Button>
      </div>

      {/* Deployment Logs */}
      {(deploymentLogs.length > 0 || deploymentStatus) && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Deployment Status</h3>
            {deploymentStatus && (
              <span className={`text-xs px-2 py-1 rounded font-medium ${
                deploymentStatus === 'completed' || deploymentStatus === 'undeployed' ? 'bg-green-100 text-green-800' :
                deploymentStatus === 'failed' || deploymentStatus === 'undeploy_failed' ? 'bg-red-100 text-red-800' :
                deploymentStatus === 'deploying' || deploymentStatus === 'provisioning_db' || deploymentStatus === 'configuring_nginx' ? 'bg-blue-100 text-blue-800' :
                deploymentStatus === 'undeploying' ? 'bg-orange-100 text-orange-800' :
                deploymentStatus === 'pending' || deploymentStatus === 'initiating' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {deploymentStatus === 'provisioning_db' ? '🗄️ Provisioning Database' :
                 deploymentStatus === 'configuring_nginx' ? '🌐 Configuring Nginx' :
                 deploymentStatus === 'deploying' ? '🚀 Deploying' :
                 deploymentStatus === 'completed' ? '✅ Completed' :
                 deploymentStatus === 'failed' ? '❌ Failed' :
                 deploymentStatus === 'pending' ? '⏳ Pending' :
                 deploymentStatus === 'initiating' ? '🔄 Initiating' :
                 deploymentStatus === 'undeploying' ? '🗑️ Undeploying' :
                 deploymentStatus === 'undeployed' ? '✅ Undeployed' :
                 deploymentStatus === 'undeploy_failed' ? '❌ Undeploy Failed' :
                 deploymentStatus}
              </span>
            )}
          </div>
          
          {/* Progress indicator for active deployments */}
          {deploymentStatus && !['completed', 'failed'].includes(deploymentStatus) && (
            <div className="mb-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <span className="inline-block animate-spin">⟳</span>
                <span>Deployment in progress...</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: deploymentStatus === 'pending' || deploymentStatus === 'initiating' ? '10%' :
                           deploymentStatus === 'provisioning_db' ? '30%' :
                           deploymentStatus === 'deploying' ? '60%' :
                           deploymentStatus === 'configuring_nginx' ? '85%' : '50%'
                  }}
                />
              </div>
            </div>
          )}
          
          <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs space-y-1 max-h-80 overflow-y-auto">
            {deploymentLogs.length === 0 ? (
              <div className="text-gray-500">Waiting for logs...</div>
            ) : (
              deploymentLogs.map((log, i) => (
                <div 
                  key={i} 
                  className={
                    log.includes('✅') || log.includes('✓') ? 'text-green-400' :
                    log.includes('❌') || log.includes('Error') ? 'text-red-400' :
                    log.includes('⏳') || log.includes('...') ? 'text-yellow-400' :
                    'text-gray-300'
                  }
                >
                  {log}
                </div>
              ))
            )}
          </div>
          {deploymentId && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
              <span>
                Deployment ID: <code className="bg-gray-200 px-2 py-1 rounded">{deploymentId}</code>
              </span>
              {app?.lastDeployment?.startedAt && (
                <span>
                  Started: {new Date(app.lastDeployment.startedAt).toLocaleString()}
                  {app?.lastDeployment?.endedAt && (
                    <> · Completed: {new Date(app.lastDeployment.endedAt).toLocaleString()}</>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Undeploy Confirmation Modal */}
      {showUndeployConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🗑️ Undeploy Application
            </h3>
            <div className="text-gray-600 mb-4 space-y-3">
              <p>
                This will remove the deployed application and clean up associated resources:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Stop the running application process</li>
                <li>Remove Docker volumes (node_modules, .next cache)</li>
                <li>Remove nginx configuration</li>
                <li>Clean up build artifacts</li>
              </ul>
              <p className="text-sm text-orange-600 font-medium">
                After undeploying, you can redeploy the app with a fresh state.
                This is useful when deployment fails due to package-lock.json sync errors.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowUndeployConfirm(false)}
                disabled={undeploying}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleUndeploy}
                loading={undeploying}
                disabled={undeploying}
              >
                {undeploying ? 'Undeploying...' : 'Undeploy'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

