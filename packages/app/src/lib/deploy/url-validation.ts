/**
 * URL Validation Utilities
 * 
 * Validates URLs for external apps with special handling for localhost and private networks.
 */

/**
 * Check if a hostname is localhost or a private network address
 */
function isLocalOrPrivateAddress(hostname: string): boolean {
  // Localhost variants
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  ) {
    return true;
  }

  // Private IPv4 ranges
  const privateIPv4Patterns = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
  ];

  if (privateIPv4Patterns.some(pattern => pattern.test(hostname))) {
    return true;
  }

  // Private IPv6 ranges (basic check)
  if (hostname.startsWith('fc') || hostname.startsWith('fd')) {
    return true; // Unique Local Addresses (fc00::/7)
  }

  return false;
}

/**
 * Validate external app URL
 * 
 * Rules:
 * - Must be a valid URL
 * - Must use HTTPS for public addresses
 * - Can use HTTP for localhost and private network addresses
 */
export function validateExternalAppUrl(url: string, devMode: boolean = false): { 
  valid: boolean; 
  error?: string; 
} {
  // Allow local-dev:// protocol for development mode
  if (url.startsWith('local-dev://')) {
    if (!devMode) {
      return {
        valid: false,
        error: 'local-dev:// URLs are only valid when Development Mode is enabled',
      };
    }
    return { valid: true };
  }

  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    const hostname = urlObj.hostname;

    // Check if protocol is http or https
    if (protocol !== 'http:' && protocol !== 'https:') {
      return {
        valid: false,
        error: 'URL must use HTTP or HTTPS protocol',
      };
    }

    // If using HTTP, validate it's for localhost or private network
    if (protocol === 'http:') {
      if (!isLocalOrPrivateAddress(hostname)) {
        return {
          valid: false,
          error: 'HTTP is only allowed for localhost and private networks (10.*, 172.16-31.*, 192.168.*). Public URLs must use HTTPS.',
        };
      }
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format',
    };
  }
}

/**
 * Get a user-friendly description of allowed URL formats
 */
export function getUrlValidationHelp(): string {
  return 'HTTPS required for public URLs. HTTP allowed for localhost and private networks (10.*, 172.16-31.*, 192.168.*).';
}


