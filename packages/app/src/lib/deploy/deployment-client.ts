/**
 * Deployment Service Client
 * 
 * Server-side client for calling the deployment service API.
 * Deployment service runs on port 8011 in the authz container.
 */

import type { BusiboxManifest } from './manifest-schema';

// Deployment service runs on port 8011 (separate from authz on 8010)
// For local dev: localhost:8011, for production: 10.96.200.210:8011
const DEPLOYMENT_SERVICE_URL = process.env.DEPLOYMENT_SERVICE_URL || 
  (process.env.NODE_ENV === 'production' ? 'http://10.96.200.210:8011/api/v1/deployment' : 'http://localhost:8011/api/v1/deployment');

export interface DeployAppRequest {
  appId: string;
  appName: string;
  githubRepo?: string;  // Required for GitHub mode
  githubToken?: string;
  localDevDir?: string; // Required for local dev mode
  manifest: BusiboxManifest;
  environment?: 'production' | 'staging' | 'development';
  devMode?: boolean;
}

export interface DeploymentResult {
  deploymentId: string;
  status: string;
  message?: string;
}

export interface DeploymentStatus {
  deploymentId: string;
  status: 'pending' | 'provisioning_db' | 'deploying' | 'configuring_nginx' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  logs: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * Deploy an app via deployment service
 * 
 * This is a SERVER-SIDE function that requires an admin JWT token.
 * Call this from API routes with the session JWT.
 */
export async function deployApp(
  request: DeployAppRequest,
  adminToken: string
): Promise<DeploymentResult> {
  let githubRepoOwner: string | undefined;
  let githubRepoName: string | undefined;

  // For GitHub mode, parse repo URL
  if (request.githubRepo && !request.devMode) {
    const repoMatch = request.githubRepo.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL');
    }
    [, githubRepoOwner, githubRepoName] = repoMatch;
  }
  
  // Build request body matching DeployRequest model on the server
  const requestBody = {
    manifest: {
      name: request.manifest.name,
      id: request.manifest.id,
      version: request.manifest.version,
      description: request.manifest.description,
      icon: request.manifest.icon || 'Rocket',
      defaultPath: request.manifest.defaultPath,
      defaultPort: request.manifest.defaultPort,
      healthEndpoint: request.manifest.healthEndpoint,
      buildCommand: request.manifest.buildCommand,
      startCommand: request.manifest.startCommand,
      appMode: request.manifest.appMode,
      database: request.manifest.database,
      requiredEnvVars: request.manifest.requiredEnvVars || [],
      optionalEnvVars: request.manifest.optionalEnvVars || [],
      busiboxAppVersion: request.manifest.busiboxAppVersion,
      // Custom service fields (passed through when appMode == "custom")
      ...(request.manifest.runtime ? { runtime: request.manifest.runtime } : {}),
      ...(request.manifest.services ? { services: request.manifest.services } : {}),
      ...(request.manifest.auth ? { auth: request.manifest.auth } : {}),
    },
    config: {
      githubRepoOwner: githubRepoOwner || '',
      githubRepoName: githubRepoName || '',
      githubBranch: 'main',
      githubToken: request.githubToken,
      environment: request.environment || 'production',
      secrets: {},
      // Local dev mode fields
      localDevDir: request.localDevDir,
      devMode: request.devMode || false,
    },
  };

  const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/deploy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Deployment failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return {
    deploymentId: data.deploymentId,
    status: data.status,
    message: `App URL: ${data.appUrl}`,
  };
}

/**
 * Validate a local dev directory
 * 
 * This is a SERVER-SIDE function that requires an admin JWT token.
 */
export interface LocalDevValidationResult {
  valid: boolean;
  manifest?: BusiboxManifest;
  dirPath?: string;
  error?: string;
}

export async function validateLocalDevDirectory(
  dirName: string,
  adminToken: string
): Promise<LocalDevValidationResult> {
  const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/validate-local-dev`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dirName }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    return {
      valid: false,
      error: error.detail || `Validation failed: ${response.statusText}`,
    };
  }
  
  return response.json();
}

/**
 * Get deployment status
 * 
 * This is a SERVER-SIDE function that requires an admin JWT token.
 */
export async function getDeploymentStatus(
  deploymentId: string,
  adminToken: string
): Promise<DeploymentStatus> {
  const response = await fetch(
    `${DEPLOYMENT_SERVICE_URL}/deploy/${deploymentId}/status`,
    {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to get deployment status: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * CLIENT-SIDE: Connect to deployment logs WebSocket
 * 
 * This is for client-side use in React components.
 * Token must be obtained from session.
 */
export async function connectDeploymentLogs(
  deploymentId: string,
  token: string,
  onStatus: (status: DeploymentStatus) => void,
  onError: (error: Error) => void
): Promise<() => void> {
  const wsUrl = DEPLOYMENT_SERVICE_URL.replace(/^http/, 'ws');
  // Pass token as query parameter for WebSocket auth
  const ws = new WebSocket(`${wsUrl}/deploy/${deploymentId}/logs?token=${encodeURIComponent(token)}`);
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.error) {
        onError(new Error(data.error));
        ws.close();
        return;
      }
      
      if (data.final) {
        onStatus(data.status);
        ws.close();
        return;
      }
      
      onStatus(data);
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Failed to parse message'));
    }
  };
  
  ws.onerror = () => {
    onError(new Error('WebSocket connection error'));
  };
  
  ws.onclose = () => {
    console.log('[Deployment] WebSocket connection closed');
  };
  
  // Return cleanup function
  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}

/**
 * Undeploy result from deployment service
 */
export interface UndeployResult {
  success: boolean;
  appId: string;
  logs: string[];
  error?: string;
}

/**
 * Undeploy an app, removing all associated resources
 * 
 * This cleans up:
 * - Running process
 * - Docker volumes (node_modules, .next cache)
 * - nginx configuration
 * - Build artifacts
 * 
 * Use this when:
 * - Deployment failed due to package-lock.json sync errors
 * - You need to clean up volumes that are blocking file operations
 * - You want to completely remove an app from the system
 * 
 * After undeploying, you can redeploy with a fresh state.
 * 
 * This is a SERVER-SIDE function that requires an admin JWT token.
 */
export async function undeployApp(
  appId: string,
  adminToken: string,
  removeVolumes: boolean = true
): Promise<UndeployResult> {
  const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/undeploy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId,
      removeVolumes,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    return {
      success: false,
      appId,
      logs: [],
      error: error.detail || `Undeploy failed: ${response.statusText}`,
    };
  }
  
  return response.json();
}

/**
 * Stop an app without removing volumes
 * 
 * This is a lighter operation than undeploy - it just stops the process.
 * 
 * This is a SERVER-SIDE function that requires an admin JWT token.
 */
export async function stopApp(
  appId: string,
  adminToken: string
): Promise<{ success: boolean; appId: string; logs: string[]; error?: string }> {
  const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/stop/${appId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    return {
      success: false,
      appId,
      logs: [],
      error: error.detail || `Stop failed: ${response.statusText}`,
    };
  }
  
  return response.json();
}

/**
 * Version check response from deployment service
 */
export interface VersionCheckResult {
  latestVersion: string;
  latestReleaseUrl?: string;
  latestReleaseNotes?: string;
  publishedAt?: string;
  updateAvailable: boolean;
}

/**
 * Check for updates to a GitHub app
 * 
 * This is a SERVER-SIDE function that requires an admin JWT token.
 */
export async function checkAppVersion(
  githubRepoOwner: string,
  githubRepoName: string,
  currentVersion: string | undefined,
  githubToken: string | undefined,
  adminToken: string
): Promise<VersionCheckResult> {
  const response = await fetch(`${DEPLOYMENT_SERVICE_URL}/version-check`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      githubOwner: githubRepoOwner,
      githubRepo: githubRepoName,
      currentVersion,
      githubToken,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Version check failed: ${response.statusText}`);
  }
  
  return response.json();
}
