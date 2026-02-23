/**
 * Search Provider Configuration Loader for busibox-portal
 *
 * Web search is now handled entirely by search-api. This module provides
 * initializeSearchProviders() and clearSearchProviderCache() for backward
 * compatibility; both are no-ops since SearchProviderFactory was removed.
 */

/**
 * No-op. Web search is handled by search-api; no client-side provider init needed.
 */
export async function initializeSearchProviders(): Promise<void> {
  // No-op: search-api handles all provider configuration
}

/**
 * No-op. Kept for backward compatibility (e.g. admin route calls after config updates).
 */
export function clearSearchProviderCache(): void {
  // No-op: no client-side cache to clear
}

