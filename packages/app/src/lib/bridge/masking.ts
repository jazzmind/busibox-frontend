/**
 * Shared masking utilities for sensitive config values.
 * Used by bridge config and email config to mask secrets in API responses.
 */

export function maskValue(value: string | null): string | null {
  if (!value || value.length <= 8) return value ? '****' : null;
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

export function isMaskedValue(value: unknown): boolean {
  return typeof value === 'string' && value.includes('****');
}
