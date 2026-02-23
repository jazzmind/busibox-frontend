/**
 * GitHub Manifest Fetcher
 * 
 * Fetches and validates busibox.json manifests from GitHub repositories.
 */

import type { BusiboxManifest } from './manifest-schema';

interface GitHubUrlParts {
  owner: string;
  repo: string;
}

/**
 * Parse GitHub URL into owner and repo
 */
export function parseGitHubUrl(url: string): GitHubUrlParts {
  // Handle various GitHub URL formats:
  // https://github.com/owner/repo
  // https://github.com/owner/repo.git
  // git@github.com:owner/repo.git
  
  let cleanUrl = url.trim();
  
  // Remove .git suffix if present
  if (cleanUrl.endsWith('.git')) {
    cleanUrl = cleanUrl.slice(0, -4);
  }
  
  // Handle SSH format
  if (cleanUrl.startsWith('git@github.com:')) {
    cleanUrl = cleanUrl.replace('git@github.com:', 'https://github.com/');
  }
  
  // Extract owner/repo from URL
  const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL format');
  }
  
  return {
    owner: match[1],
    repo: match[2],
  };
}

/**
 * Check if URL is a GitHub URL
 */
export function isGitHubUrl(url: string): boolean {
  return url.includes('github.com');
}

/**
 * Fetch busibox.json manifest from GitHub repository
 * 
 * @param repoUrl - GitHub repository URL
 * @param token - Optional GitHub token (uses env var if not provided)
 * @param branch - Branch to fetch from (default: main)
 * @returns Parsed manifest
 */
export async function fetchManifestFromGitHub(
  repoUrl: string,
  token?: string,
  branch: string = 'main'
): Promise<BusiboxManifest> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  
  // Try main first, then master
  const branches = branch === 'main' ? ['main', 'master'] : [branch];
  
  for (const branchName of branches) {
    try {
      const manifestUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branchName}/busibox.json`;
      
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };
      
      // Add token if provided (required for private repos)
      const githubToken = token || process.env.GITHUB_TOKEN;
      if (githubToken) {
        headers['Authorization'] = `token ${githubToken}`;
      }
      
      const response = await fetch(manifestUrl, { headers });
      
      if (response.ok) {
        const manifest = await response.json();
        return manifest;
      }
      
      // If this branch doesn't exist, try next
      if (response.status === 404 && branchName !== branches[branches.length - 1]) {
        continue;
      }
      
      // Other errors
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // If this is the last branch to try, throw the error
      if (branchName === branches[branches.length - 1]) {
        throw error;
      }
    }
  }
  
  throw new Error('Could not find busibox.json in main or master branch');
}

/**
 * Validate GitHub repository access
 * 
 * @param repoUrl - GitHub repository URL
 * @param token - Optional GitHub token
 * @returns True if repo is accessible
 */
export async function validateGitHubAccess(
  repoUrl: string,
  token?: string
): Promise<{ accessible: boolean; error?: string }> {
  try {
    const { owner, repo } = parseGitHubUrl(repoUrl);
    
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };
    
    const githubToken = token || process.env.GITHUB_TOKEN;
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }
    
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    
    if (response.ok) {
      return { accessible: true };
    }
    
    if (response.status === 404) {
      return { 
        accessible: false, 
        error: 'Repository not found or you do not have access. For private repos, provide a GitHub token.' 
      };
    }
    
    if (response.status === 401 || response.status === 403) {
      return { 
        accessible: false, 
        error: 'Invalid GitHub token or insufficient permissions' 
      };
    }
    
    return { 
      accessible: false, 
      error: `GitHub API error: ${response.status}` 
    };
  } catch (error) {
    return { 
      accessible: false, 
      error: error instanceof Error ? error.message : 'Failed to validate GitHub access' 
    };
  }
}

/**
 * Fetch manifest and validate GitHub access
 * 
 * @param repoUrl - GitHub repository URL
 * @param token - Optional GitHub token
 * @returns Validation result with manifest if successful
 */
export async function fetchAndValidateManifest(
  repoUrl: string,
  token?: string
): Promise<{ 
  valid: boolean; 
  manifest?: BusiboxManifest; 
  error?: string;
}> {
  try {
    // First validate repo access
    const accessCheck = await validateGitHubAccess(repoUrl, token);
    if (!accessCheck.accessible) {
      return {
        valid: false,
        error: accessCheck.error,
      };
    }
    
    // Fetch manifest
    const manifest = await fetchManifestFromGitHub(repoUrl, token);
    
    // Basic validation
    if (!manifest.name || !manifest.id || !manifest.defaultPath || !manifest.defaultPort) {
      return {
        valid: false,
        error: 'Invalid manifest: missing required fields (name, id, defaultPath, defaultPort)',
      };
    }
    
    return {
      valid: true,
      manifest,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to fetch manifest',
    };
  }
}
