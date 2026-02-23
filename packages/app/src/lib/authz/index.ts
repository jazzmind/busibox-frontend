/**
 * AuthZ module — everything related to the authz service.
 *
 * Includes: zero-trust token exchange, delegation tokens, SSO validation,
 * SSO generation, session client, auth helpers, RBAC, audit, passkeys,
 * permissions, user management, email validation.
 */

// Zero Trust token exchange
export {
  exchangeTokenZeroTrust,
  getAuthHeaderZeroTrust,
  createZeroTrustClient,
  invalidateZeroTrustToken,
  clearZeroTrustTokenCache,
  isValidJwtFormat,
  parseJwtClaimsUnsafe,
  getUserIdFromSessionJwt,
  InvalidSessionError,
  isInvalidSessionError,
  type AuthzAudience,
  type ZeroTrustExchangeRequest,
  type ZeroTrustExchangeResponse,
  type ZeroTrustClientConfig,
  type ZeroTrustClient,
} from './zero-trust';

// Delegation tokens
export {
  createDelegationToken,
  listDelegationTokens,
  revokeDelegationToken,
  type DelegationToken,
  type DelegationTokenInfo,
} from './delegation';

// Auth helpers (JWT parsing, token extraction)
export {
  sanitizeAppName,
  getTokenFromRequest,
  getSessionFromRequest,
  requireToken,
  getAuthHeaders,
  getSSEHeaders,
  hasToken,
  parseJWTPayload,
  isTokenExpired,
  getTokenExpiration,
  getUserIdFromToken,
  getUserEmailFromToken,
  getUserRolesFromToken,
  tokenHasRole,
  tokenIsAdmin,
  shouldRefreshToken,
  getScopesFromToken,
  hasScope,
  hasAllScopes,
} from './auth-helper';

// Auth state manager (client-side)
export {
  createAuthStateManager,
  getGlobalAuthManager,
  setGlobalAuthManager,
  clearGlobalAuthManager,
  isAuthInitializing,
  setAuthInitializing,
  type AuthState,
  type AuthStateManagerConfig,
  type AuthEventType,
  type AuthStateManager,
} from './auth-state-manager';

// Session client (sessions, magic links, TOTP, passkeys via authz)
export {
  createSession,
  validateSession,
  deleteSession,
  deleteUserSessions,
  createMagicLink,
  validateMagicLink,
  useMagicLink,
  createTotpCode,
  verifyTotpCode,
  createPasskeyChallenge,
  registerPasskey,
  listUserPasskeys,
  deletePasskey,
  authenticateWithPasskey,
  initiateLogin,
  cleanupExpired,
  type Session,
  type CreateSessionParams,
  type MagicLink,
  type Passkey,
  type AuthClientOptions,
} from './session-client';

// SSO validation
export {
  validateSSOToken,
  createSessionFromSSO,
  invalidateJwksCache,
  hasSessionRole,
  hasSessionScope,
  isSessionAdmin,
  type SSOValidationOptions,
  type SSOValidationResult,
  type SSOSessionData,
  type AppTokenPayload,
} from './sso';

// SSO route handlers
export {
  createSSOGetHandler,
  createSSOPostHandler,
  type SSOHandlerOptions,
  type SSOPostResult,
} from './sso-route-handler';

// Email validation
export * from './email-validation';
