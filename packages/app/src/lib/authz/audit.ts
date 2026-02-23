/**
 * Audit Client for busibox-app
 * 
 * Centralized audit logging client that writes to the authz service.
 * All Busibox applications should use this client for audit logging.
 * 
 * Usage:
 * ```typescript
 * import { logAuditEvent, logUserLogin } from 'busibox-app';
 * 
 * await logAuditEvent({
 *   actorId: 'user-123',
 *   action: 'document.upload',
 *   resourceType: 'document',
 *   resourceId: 'doc-456',
 *   details: { filename: 'report.pdf' },
 * });
 * ```
 */

const DEFAULT_AUTHZ_URL = process.env.AUTHZ_BASE_URL || process.env.AUTHZ_URL || 'http://authz-api:8010';

export interface AuditEventParams {
  /** User or system ID performing the action */
  actorId: string;
  /** Action being performed (e.g., 'user.login', 'document.upload') */
  action: string;
  /** Type of resource being acted upon (e.g., 'user', 'document', 'session') */
  resourceType: string;
  /** Optional ID of the specific resource */
  resourceId?: string | null;
  /** Optional additional details (will be stored as JSON) */
  details?: Record<string, unknown>;
}

export interface AuditClientOptions {
  /** User ID (for server-side token acquisition) */
  userId?: string;
  /** Custom token acquisition function */
  getAuthzToken?: (userId: string, audience: string, scopes: string[]) => Promise<string>;
  /** Override authz service URL */
  authzUrl?: string;
  /** Access token (JWT) for Zero Trust authentication */
  accessToken?: string;
}

/**
 * Get authorization header for audit API calls.
 * Zero Trust: Uses access token (JWT) for authentication.
 */
async function getAuthHeader(options: AuditClientOptions): Promise<string | undefined> {
  // Zero Trust: Access token (JWT) takes precedence
  if (options.accessToken) {
    return `Bearer ${options.accessToken}`;
  }

  // Server-side: use custom token acquisition
  if (options.getAuthzToken && options.userId) {
    const token = await options.getAuthzToken(options.userId, 'authz', []);
    return `Bearer ${token}`;
  }

  // No authentication provided (authz audit endpoint may allow unauthenticated writes)
  return undefined;
}

/**
 * Write audit event to authz service
 * 
 * @param event - Audit event parameters
 * @param options - Client options (optional tokenManager for user context)
 */
export async function logAuditEvent(
  event: AuditEventParams,
  options: AuditClientOptions = {}
): Promise<void> {
  const baseUrl = options.authzUrl || DEFAULT_AUTHZ_URL;

  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add authorization if available
    const authHeader = await getAuthHeader(options);
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${baseUrl}/audit/log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        actor_id: event.actorId,
        action: event.action,
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        details: event.details,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[AUDIT] Failed to write audit log:', response.status, errorText);
    }
  } catch (error) {
    // Don't throw - audit logging shouldn't break the app
    console.error('[AUDIT] Failed to write audit log:', error);
  }
}

// ============================================================================
// Convenience Functions for Common Events
// ============================================================================

/**
 * Log a successful user login
 */
export async function logUserLogin(
  userId: string,
  sessionId: string,
  options?: AuditClientOptions & { method?: string }
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'user.login',
    resourceType: 'session',
    resourceId: sessionId,
    details: { method: options?.method || 'magic_link' },
  }, options);
}

/**
 * Log a user logout
 */
export async function logUserLogout(
  userId: string,
  sessionId: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'user.logout',
    resourceType: 'session',
    resourceId: sessionId,
  }, options);
}

/**
 * Log a failed login attempt
 */
export async function logLoginFailed(
  email: string,
  reason: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId: 'system',
    action: 'user.login.failed',
    resourceType: 'user',
    details: { email, reason },
  }, options);
}

/**
 * Log a password reset request
 */
export async function logPasswordResetRequest(
  userId: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'user.password_reset.requested',
    resourceType: 'user',
    resourceId: userId,
  }, options);
}

/**
 * Log a password reset completion
 */
export async function logPasswordReset(
  userId: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'user.password_reset.completed',
    resourceType: 'user',
    resourceId: userId,
  }, options);
}

/**
 * Log role assignment
 */
export async function logRoleAssigned(
  actorId: string,
  targetUserId: string,
  roleId: string,
  roleName: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'role.assigned',
    resourceType: 'user_role',
    resourceId: targetUserId,
    details: { roleId, roleName, targetUserId },
  }, options);
}

/**
 * Log role removal
 */
export async function logRoleRemoved(
  actorId: string,
  targetUserId: string,
  roleId: string,
  roleName: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'role.removed',
    resourceType: 'user_role',
    resourceId: targetUserId,
    details: { roleId, roleName, targetUserId },
  }, options);
}

/**
 * Log user creation
 */
export async function logUserCreated(
  actorId: string,
  targetUserId: string,
  email: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'user.created',
    resourceType: 'user',
    resourceId: targetUserId,
    details: { email },
  }, options);
}

/**
 * Log user deletion
 */
export async function logUserDeleted(
  actorId: string,
  targetUserId: string,
  email: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'user.deleted',
    resourceType: 'user',
    resourceId: targetUserId,
    details: { email },
  }, options);
}

/**
 * Log user status change
 */
export async function logUserStatusChanged(
  actorId: string,
  targetUserId: string,
  oldStatus: string,
  newStatus: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'user.status_changed',
    resourceType: 'user',
    resourceId: targetUserId,
    details: { oldStatus, newStatus },
  }, options);
}

/**
 * Log document upload
 */
export async function logDocumentUploaded(
  userId: string,
  documentId: string,
  filename: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'document.uploaded',
    resourceType: 'document',
    resourceId: documentId,
    details: { filename },
  }, options);
}

/**
 * Log document deletion
 */
export async function logDocumentDeleted(
  userId: string,
  documentId: string,
  filename: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'document.deleted',
    resourceType: 'document',
    resourceId: documentId,
    details: { filename },
  }, options);
}

/**
 * Log document access
 */
export async function logDocumentAccessed(
  userId: string,
  documentId: string,
  filename: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'document.accessed',
    resourceType: 'document',
    resourceId: documentId,
    details: { filename },
  }, options);
}

/**
 * Log configuration change
 */
export async function logConfigChanged(
  actorId: string,
  configKey: string,
  oldValue: unknown,
  newValue: unknown,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'config.changed',
    resourceType: 'configuration',
    resourceId: configKey,
    details: { configKey, oldValue, newValue },
  }, options);
}

/**
 * Log API key generation
 */
export async function logApiKeyGenerated(
  userId: string,
  keyId: string,
  keyName: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'api_key.generated',
    resourceType: 'api_key',
    resourceId: keyId,
    details: { keyName },
  }, options);
}

/**
 * Log API key revocation
 */
export async function logApiKeyRevoked(
  userId: string,
  keyId: string,
  keyName: string,
  options?: AuditClientOptions
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'api_key.revoked',
    resourceType: 'api_key',
    resourceId: keyId,
    details: { keyName },
  }, options);
}

// ============================================================================
// App Management Audit Functions
// ============================================================================

export async function logAppRegistered(
  appId: string,
  appName: string,
  actorId: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'app.registered',
    resourceType: 'app',
    resourceId: appId,
    details: { appName },
  }, options);
}

export async function logAppUpdated(
  appId: string,
  appName: string,
  actorId: string,
  updates?: Record<string, unknown>,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'app.updated',
    resourceType: 'app',
    resourceId: appId,
    details: { appName, updates },
  }, options);
}

export async function logAppDeleted(
  appId: string,
  appName: string,
  actorId: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'app.deleted',
    resourceType: 'app',
    resourceId: appId,
    details: { appName },
  }, options);
}

// ============================================================================
// Magic Link & TOTP Audit Functions
// ============================================================================

export async function logMagicLinkSent(
  email: string,
  userId: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'magic_link.sent',
    resourceType: 'auth',
    resourceId: userId,
    details: { email },
  }, options);
}

export async function logMagicLinkUsed(
  userId: string,
  email: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'magic_link.used',
    resourceType: 'auth',
    resourceId: userId,
    details: { email },
  }, options);
}

export async function logMagicLinkExpired(
  email: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: 'system',
    action: 'magic_link.expired',
    resourceType: 'auth',
    details: { email },
  }, options);
}

export async function logTotpCodeSent(
  email: string,
  userId: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'totp.code_sent',
    resourceType: 'auth',
    resourceId: userId,
    details: { email },
  }, options);
}

export async function logTotpCodeUsed(
  userId: string,
  email: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'totp.code_used',
    resourceType: 'auth',
    resourceId: userId,
    details: { email },
  }, options);
}

export async function logTotpCodeFailed(
  email: string,
  reason: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: 'system',
    action: 'totp.code_failed',
    resourceType: 'auth',
    details: { email, reason },
  }, options);
}

// ============================================================================
// Passkey (WebAuthn) Audit Functions
// ============================================================================

export async function logPasskeyRegistered(
  userId: string,
  email: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'passkey.registered',
    resourceType: 'passkey',
    resourceId: userId,
    details: { email },
  }, options);
}

export async function logPasskeyRemoved(
  userId: string,
  passkeyId: string,
  passkeyName?: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'passkey.removed',
    resourceType: 'passkey',
    resourceId: passkeyId,
    details: { userId, passkeyName },
  }, options);
}

export async function logPasskeyLogin(
  userId: string,
  passkeyId: string,
  sessionId: string,
  ipAddress?: string,
  userAgent?: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'passkey.login',
    resourceType: 'session',
    resourceId: sessionId,
    details: { userId, passkeyId, ipAddress, userAgent },
  }, options);
}

export async function logPasskeyLoginFailed(
  email: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: 'system',
    action: 'passkey.login_failed',
    resourceType: 'auth',
    details: { email, reason, ipAddress, userAgent },
  }, options);
}

// ============================================================================
// OAuth Audit Functions
// ============================================================================

export async function logOAuthTokenGenerated(
  userId: string,
  clientId: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'oauth.token_generated',
    resourceType: 'oauth_token',
    details: { clientId },
  }, options);
}

export async function logOAuthTokenValidated(
  userId: string,
  clientId: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: userId,
    action: 'oauth.token_validated',
    resourceType: 'oauth_token',
    details: { clientId },
  }, options);
}

export async function logOAuthTokenRejected(
  clientId: string,
  reason: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: 'system',
    action: 'oauth.token_rejected',
    resourceType: 'oauth_token',
    details: { clientId, reason },
  }, options);
}

// ============================================================================
// Role & Permission Audit Functions
// ============================================================================

export async function logRoleCreated(
  roleId: string,
  roleName: string,
  actorId: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'role.created',
    resourceType: 'role',
    resourceId: roleId,
    details: { roleName },
  }, options);
}

export async function logRoleUpdated(
  roleId: string,
  roleName: string,
  actorId: string,
  updates?: Record<string, unknown>,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'role.updated',
    resourceType: 'role',
    resourceId: roleId,
    details: { roleName, updates },
  }, options);
}

export async function logRoleDeleted(
  roleId: string,
  roleName: string,
  actorId: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'role.deleted',
    resourceType: 'role',
    resourceId: roleId,
    details: { roleName },
  }, options);
}

export async function logPermissionGranted(
  roleId: string,
  roleName: string,
  appId: string,
  appName: string,
  actorId: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'permission.granted',
    resourceType: 'permission',
    resourceId: `${roleId}:${appId}`,
    details: { roleId, roleName, appId, appName },
  }, options);
}

export async function logPermissionRevoked(
  roleId: string,
  roleName: string,
  appId: string,
  appName: string,
  actorId: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'permission.revoked',
    resourceType: 'permission',
    resourceId: `${roleId}:${appId}`,
    details: { roleId, roleName, appId, appName },
  }, options);
}

// ============================================================================
// User Status Audit Functions
// ============================================================================

export async function logUserActivated(
  userId: string,
  email: string,
  actorId?: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId: actorId || userId,
    action: 'user.activated',
    resourceType: 'user',
    resourceId: userId,
    details: { email },
  }, options);
}

export async function logUserDeactivated(
  userId: string,
  email: string,
  actorId: string,
  options: AuditClientOptions = {}
): Promise<void> {
  return logAuditEvent({
    actorId,
    action: 'user.deactivated',
    resourceType: 'user',
    resourceId: userId,
    details: { email },
  }, options);
}

// ============================================================================
// Legacy type alias and logEvent for backward compatibility
// ============================================================================

/**
 * Audit event type string union
 *
 * Previously this was imported from Prisma. Now it's a simple string union
 * matching the event types supported by the authz service.
 */
export type AuditEventType =
  | 'USER_LOGIN'
  | 'USER_LOGIN_FAILED'
  | 'USER_LOGOUT'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET'
  | 'ROLE_ASSIGNED'
  | 'ROLE_REMOVED'
  | 'USER_CREATED'
  | 'USER_DELETED'
  | 'USER_STATUS_CHANGED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'
  | 'DOCUMENT_ACCESSED'
  | 'CONFIG_CHANGED'
  | 'API_KEY_GENERATED'
  | 'API_KEY_REVOKED'
  | 'APP_REGISTERED'
  | 'APP_UPDATED'
  | 'APP_DELETED'
  | 'MAGIC_LINK_SENT'
  | 'MAGIC_LINK_USED'
  | 'MAGIC_LINK_EXPIRED'
  | 'TOTP_CODE_SENT'
  | 'TOTP_CODE_USED'
  | 'TOTP_CODE_FAILED'
  | 'PASSKEY_REGISTERED'
  | 'PASSKEY_REMOVED'
  | 'PASSKEY_LOGIN'
  | 'PASSKEY_LOGIN_FAILED'
  | 'OAUTH_TOKEN_GENERATED'
  | 'OAUTH_TOKEN_VALIDATED'
  | 'OAUTH_TOKEN_REJECTED'
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_REVOKED'
  | 'ACCESS_DENIED'
  | 'SESSION_EXPIRED';

export type AuditLogParams = {
  eventType: AuditEventType | string;
  userId?: string | null;
  targetUserId?: string | null;
  targetRoleId?: string | null;
  targetAppId?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success?: boolean;
  errorMessage?: string | null;
};

/**
 * Log a security or audit event
 *
 * This function provides backward compatibility with the old Prisma-based
 * audit logging. It now writes directly to the authz service.
 *
 * @param params - Audit log parameters
 */
export async function logEvent(params: AuditLogParams): Promise<void> {
  try {
    await logAuditEvent({
      actorId: params.userId || 'system',
      action: params.action,
      resourceType: params.eventType,
      resourceId: params.targetUserId || params.targetRoleId || params.targetAppId || undefined,
      details: {
        ...params.details,
        targetUserId: params.targetUserId,
        targetRoleId: params.targetRoleId,
        targetAppId: params.targetAppId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        success: params.success ?? true,
        errorMessage: params.errorMessage,
      },
    });
  } catch (error) {
    // Log to console if write fails (don't throw - audit logging shouldn't break the app)
    console.error('[AUDIT] Failed to write audit log:', error);
  }
}
