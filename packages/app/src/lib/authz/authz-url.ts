/**
 * Shared authz service URL resolution.
 *
 * Extracted into its own module to avoid circular dependencies between
 * next-client.ts (which re-exports delegation.ts) and delegation.ts.
 */

/**
 * Get the authz service base URL.
 * Uses AUTHZ_BASE_URL env var or defaults to Docker service name.
 */
export function getAuthzBaseUrl(): string {
  return process.env.AUTHZ_BASE_URL || process.env.AUTHZ_URL || 'http://authz-api:8010';
}
