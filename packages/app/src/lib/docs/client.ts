/**
 * Documentation Library
 * 
 * Utilities for fetching documentation from the Busibox Docs API.
 * 
 * In production, this fetches from the docs-api service.
 * For local development, you can either:
 * 1. Run the docs-api container (recommended)
 * 2. Set DOCS_API_URL to point to the running service
 * 
 * The library uses Next.js fetch caching for efficient data loading.
 * 
 * Categories:
 *   - platform: End-user guides for using Busibox (previously 'user')
 *   - administrator: Deployment/configuration/operations documentation
 *   - apps: Per-app documentation contributed by installed applications
 *   - developer: Technical/developer documentation
 */

// Documentation category types
export type DocCategory = 'platform' | 'administrator' | 'apps' | 'developer';

// Frontmatter schema for documentation files
export interface DocFrontmatter {
  title: string;
  category: DocCategory;
  order: number;
  description: string;
  published: boolean;
  app_id?: string;
  app_name?: string;
}

// Parsed documentation file
export interface DocFile {
  slug: string;
  frontmatter: DocFrontmatter;
  content: string;
  filePath?: string;  // Optional - not available from API
}

// Navigation item for sidebar
export interface DocNavItem {
  slug: string;
  title: string;
  description: string;
  order: number;
  app_id?: string;
  app_name?: string;
}

// App docs group - docs grouped by app
export interface AppDocsGroup {
  app_id: string;
  app_name: string;
  docs: DocNavItem[];
}

// API response types
interface DocListResponse {
  category: string;
  docs: DocNavItem[];
}

interface DocResponse {
  slug: string;
  frontmatter: DocFrontmatter;
  content: string;
}

interface DocNavigationResponse {
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}

interface AppDocsGroupsResponse {
  groups: AppDocsGroup[];
}

/**
 * Get the base URL for the Docs API.
 * 
 * Server-side: Uses DOCS_API_URL env var (set by Ansible in Busibox deployments)
 *              Falls back to localhost:8004 for local development
 * Client-side: Uses NEXT_PUBLIC_DOCS_API_URL or falls back to /api/docs proxy
 */
function getDocsApiUrl(): string {
  // Server-side: use internal network URL from environment
  if (typeof window === 'undefined') {
    const url = process.env.DOCS_API_URL;
    if (!url) {
      console.warn('[docs] DOCS_API_URL not set, falling back to localhost:8004 (local dev only)');
    }
    return url || 'http://localhost:8004';
  }
  // Client-side: use public URL through nginx proxy
  return process.env.NEXT_PUBLIC_DOCS_API_URL || '/api/docs';
}

/**
 * Fetch with Next.js caching for documentation data.
 * Uses ISR-style caching with revalidation.
 */
async function fetchDocs<T>(endpoint: string): Promise<T | null> {
  const baseUrl = getDocsApiUrl();
  const url = `${baseUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      // Cache for 1 hour, revalidate in background
      next: { revalidate: 3600 },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error(`Docs API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    return await response.json() as T;
  } catch (error) {
    console.error(`Failed to fetch docs from ${url}:`, error);
    return null;
  }
}

/**
 * Get all published documentation files for a category
 */
export async function getDocsByCategory(category: DocCategory): Promise<DocFile[]> {
  const response = await fetchDocs<DocListResponse>(`/docs/${category}`);
  
  if (!response) {
    return [];
  }
  
  // For full docs, we need to fetch each one individually
  // This is cached by Next.js, so subsequent requests are fast
  const docs: DocFile[] = [];
  
  for (const navItem of response.docs) {
    const doc = await getDocBySlug(category, navItem.slug);
    if (doc) {
      docs.push(doc);
    }
  }
  
  return docs;
}

/**
 * Get navigation items for a category (lighter weight than full docs)
 */
export async function getDocsNavigation(category: DocCategory): Promise<DocNavItem[]> {
  const response = await fetchDocs<DocListResponse>(`/docs/${category}`);
  return response?.docs || [];
}

/**
 * Get app documentation grouped by app_id.
 * Returns docs organized by application for the apps category sidebar.
 */
export async function getAppsDocsGroups(): Promise<AppDocsGroup[]> {
  const response = await fetchDocs<AppDocsGroupsResponse>('/docs/apps/groups');
  return response?.groups || [];
}

/**
 * Get a single documentation file by slug and category
 */
export async function getDocBySlug(category: DocCategory, slug: string): Promise<DocFile | null> {
  const response = await fetchDocs<DocResponse>(`/docs/${category}/${slug}`);
  
  if (!response) {
    return null;
  }
  
  return {
    slug: response.slug,
    frontmatter: response.frontmatter,
    content: response.content,
  };
}

/**
 * Get all available documentation categories with their doc counts
 */
export async function getDocCategories(): Promise<{ category: DocCategory; count: number; label: string }[]> {
  const [platformDocs, adminDocs, appsDocs, devDocs] = await Promise.all([
    getDocsNavigation('platform'),
    getDocsNavigation('administrator'),
    getDocsNavigation('apps'),
    getDocsNavigation('developer'),
  ]);
  
  return [
    { 
      category: 'platform', 
      count: platformDocs.length,
      label: 'Platform'
    },
    { 
      category: 'administrator',
      count: adminDocs.length,
      label: 'Administrator'
    },
    {
      category: 'apps', 
      count: appsDocs.length,
      label: 'Apps'
    },
    { 
      category: 'developer', 
      count: devDocs.length,
      label: 'Developer'
    },
  ];
}

/**
 * Get previous and next docs for navigation
 */
export async function getDocNavigation(category: DocCategory, slug: string): Promise<{
  prev: DocNavItem | null;
  next: DocNavItem | null;
}> {
  const response = await fetchDocs<DocNavigationResponse>(`/docs/${category}/${slug}/navigation`);
  
  if (!response) {
    return { prev: null, next: null };
  }
  
  // Convert to full DocNavItem format
  const nav = await getDocsNavigation(category);
  
  return {
    prev: response.prev ? nav.find(item => item.slug === response.prev!.slug) || null : null,
    next: response.next ? nav.find(item => item.slug === response.next!.slug) || null : null,
  };
}
