/**
 * Email Domain Validation
 * 
 * Validates email addresses against allowed domains from environment variable.
 * Auto-creates user accounts for allowed domains, rejects others.
 */

/**
 * Get allowed domains from environment variable
 * @returns Array of normalized allowed domains
 */
function getAllowedDomainsFromEnv(): string[] {
  const domainsEnv = process.env.ALLOWED_EMAIL_DOMAINS || '';
  if (!domainsEnv.trim()) {
    return [];
  }
  return domainsEnv.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
}

/**
 * Check if email domain is allowed
 * 
 * @param email - Email address to validate
 * @returns true if domain is allowed, false otherwise
 */
export function isEmailDomainAllowed(email: string): boolean {
  const emailLower = email.toLowerCase();
  const parts = emailLower.split('@');
  
  // Basic email validation: must have exactly 2 parts (username@domain)
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }

  const domain = parts[1];
  const allowedDomains = getAllowedDomainsFromEnv();
  
  // If no domains configured or wildcard, allow all
  if (allowedDomains.length === 0 || allowedDomains.includes('*')) {
    return true;
  }

  return allowedDomains.includes(domain);
}

/**
 * Get rejection message for disallowed email domain
 * 
 * @param email - Email address that was rejected
 * @returns User-friendly error message
 */
export function getEmailDomainRejectionMessage(email: string): string {
  const domain = email.split('@')[1];
  const allowedDomains = getAllowedDomainsFromEnv();
  
  if (allowedDomains.length === 0) {
    return 'Email registration is currently disabled. Please contact your administrator.';
  }

  return `Email domain "@${domain}" is not allowed. Only ${allowedDomains.join(', ')} email addresses are allowed.`;
}

/**
 * Get list of allowed domains (for display purposes)
 * 
 * @returns Array of allowed domain strings
 */
export function getAllowedDomains(): string[] {
  return getAllowedDomainsFromEnv();
}

/**
 * Check if domain restrictions are enabled
 * 
 * @returns true if restrictions are active, false if all domains allowed
 */
export function isDomainRestrictionEnabled(): boolean {
  const allowedDomains = getAllowedDomainsFromEnv();
  return allowedDomains.length > 0 && !allowedDomains.includes('*');
}
