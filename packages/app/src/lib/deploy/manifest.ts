/**
 * Busibox Manifest Fetcher
 * 
 * Fetches and validates busibox.json manifest files from GitHub repositories.
 */

import { validateManifest, type BusiboxManifest, type ManifestValidationResult } from './manifest-schema';

export interface FetchManifestOptions {
  owner: string;
  repo: string;
  branch?: string;
  token?: string;
}

export interface FetchManifestResult {
  success: boolean;
  manifest?: BusiboxManifest;
  error?: string;
  validationErrors?: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Parse GitHub URL into owner and repo
 * Supports:
 * - https://github.com/owner/repo
 * - github.com/owner/repo
 * - owner/repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Remove trailing .git if present
  url = url.replace(/\.git$/, '');
  
  // Try full URL format
  const fullUrlMatch = url.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/);
  if (fullUrlMatch) {
    return {
      owner: fullUrlMatch[1],
      repo: fullUrlMatch[2],
    };
  }
  
  // Try without protocol
  const noProtocolMatch = url.match(/^github\.com\/([^\/]+)\/([^\/]+)/);
  if (noProtocolMatch) {
    return {
      owner: noProtocolMatch[1],
      repo: noProtocolMatch[2],
    };
  }
  
  // Try owner/repo format
  const shortMatch = url.match(/^([^\/]+)\/([^\/]+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
    };
  }
  
  return null;
}

/**
 * Fetch manifest from GitHub repository
 */
export async function fetchManifest(options: FetchManifestOptions): Promise<FetchManifestResult> {
  const { owner, repo, branch = 'main', token } = options;
  
  // Construct raw GitHub URL
  const manifestUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/busibox.json`;
  
  try {
    // Fetch manifest file
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(manifestUrl, {
      headers,
      cache: 'no-store',
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Manifest file (busibox.json) not found in repository. This repository may not be a Busibox-compatible app.',
        };
      }
      
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: 'Access denied. The repository may be private and require authentication.',
        };
      }
      
      return {
        success: false,
        error: `Failed to fetch manifest: ${response.status} ${response.statusText}`,
      };
    }
    
    // Parse JSON
    let manifestData: unknown;
    try {
      manifestData = await response.json();
    } catch (err) {
      return {
        success: false,
        error: 'Invalid JSON in busibox.json file',
      };
    }
    
    // Validate manifest
    const validation = validateManifest(manifestData);
    
    if (!validation.success) {
      return {
        success: false,
        error: 'Manifest validation failed',
        validationErrors: validation.errors,
      };
    }
    
    return {
      success: true,
      manifest: validation.manifest,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching manifest',
    };
  }
}

/**
 * Fetch manifest from GitHub URL (convenience wrapper)
 */
export async function fetchManifestFromUrl(
  url: string,
  token?: string,
  branch?: string
): Promise<FetchManifestResult> {
  const parsed = parseGitHubUrl(url);
  
  if (!parsed) {
    return {
      success: false,
      error: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo or owner/repo',
    };
  }
  
  return fetchManifest({
    owner: parsed.owner,
    repo: parsed.repo,
    branch,
    token,
  });
}

/**
 * Check if a repository has a valid Busibox manifest
 */
export async function hasValidManifest(
  owner: string,
  repo: string,
  token?: string
): Promise<boolean> {
  const result = await fetchManifest({ owner, repo, token });
  return result.success;
}
