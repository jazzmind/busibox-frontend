/**
 * User Management Client
 * 
 * Zero Trust Architecture:
 * All user CRUD operations go through authz. Authentication is handled via:
 * - User operations: Pass the user's session JWT (exchanged for access token)
 * - Login flows: Authz endpoints are unauthenticated (they ARE the authentication)
 * 
 * There are NO admin tokens or client credentials. All operations are either:
 * 1. User-initiated (with user's JWT) - user's scopes determine access
 * 2. Service account (with service account JWT) - for background operations
 */

import {
  createUser as authzCreateUser,
  updateUser as authzUpdateUser,
  deleteUser as authzDeleteUser,
  activateUser as authzActivateUser,
  deactivateUser as authzDeactivateUser,
  reactivateUser as authzReactivateUser,
  listUsers as authzListUsers,
  getUser as authzGetUser,
  getUserByEmail as authzGetUserByEmail,
  addUserRole as authzAddUserRole,
  removeUserRole as authzRemoveUserRole,
  type RbacUser,
  type UserListResponse,
  type CreateUserParams,
  type UpdateUserParams,
  type ListUsersParams,
  type AdminAuthOptions,
  exchangeTokenZeroTrust,
} from '@jazzmind/busibox-app';

/**
 * AuthzUser type - the user type returned by the authz service.
 * This is explicitly named to avoid conflict with busibox-portal's local User type.
 */
export type AuthzUser = RbacUser;

// Re-export types for convenience
export type { UserListResponse, CreateUserParams, UpdateUserParams, ListUsersParams };

// Import getAuthzBaseUrl for consistent URL handling
import { getAuthzBaseUrl } from './next-client';

/**
 * Get auth options for user management operations.
 * Zero Trust: All operations require an access token (JWT).
 * 
 * @param accessToken - Access token (JWT) with appropriate scopes
 * @returns AdminAuthOptions for rbac client
 */
function getAuthOptions(accessToken?: string): AdminAuthOptions {
  // Get URL at call time, not module load time (important for Next.js)
  const authzUrl = getAuthzBaseUrl();
  
  if (!accessToken) {
    throw new Error('Zero Trust: accessToken is required for user management operations');
  }
  
  return {
    accessToken,
    authzUrl,
  };
}

/**
 * Exchange a session JWT for an authz-api access token.
 * Use this at the API route level before calling user management functions.
 * 
 * Note: The scopes in the access token come from the user's roles, not from
 * the scopes parameter. The Admin role must have authz.* scopes configured.
 * 
 * @param sessionJwt - User's session JWT
 * @returns Access token for authz-api
 */
export async function getAuthzAccessToken(sessionJwt: string): Promise<string> {
  // Get URL at call time, not module load time (important for Next.js)
  const authzUrl = getAuthzBaseUrl();
  
  const result = await exchangeTokenZeroTrust({
    sessionJwt,
    audience: 'authz-api',
    purpose: 'user-management',
  }, {
    authzBaseUrl: authzUrl,
    verbose: process.env.VERBOSE_AUTHZ_LOGGING === 'true',
  });
  
  return result.accessToken;
}

/**
 * Create a new user in authz
 */
export async function createUser(
  params: {
    email: string;
    roleIds?: string[];
    status?: 'PENDING' | 'ACTIVE' | 'DEACTIVATED';
    assignedBy?: string;
  },
  accessToken?: string
): Promise<AuthzUser> {
  const options = getAuthOptions(accessToken);
  return authzCreateUser(
    {
      email: params.email,
      role_ids: params.roleIds,
      status: params.status || 'PENDING',
      assigned_by: params.assignedBy,
    },
    options
  );
}

/**
 * Update a user in authz
 */
export async function updateUser(
  userId: string,
  updates: UpdateUserParams,
  accessToken?: string
): Promise<AuthzUser> {
  const options = getAuthOptions(accessToken);
  return authzUpdateUser(userId, updates, options);
}

/**
 * Delete a user from authz
 */
export async function deleteUser(userId: string, accessToken?: string): Promise<void> {
  const options = getAuthOptions(accessToken);
  return authzDeleteUser(userId, options);
}

/**
 * Activate a pending user
 */
export async function activateUser(userId: string, accessToken?: string): Promise<AuthzUser> {
  const options = getAuthOptions(accessToken);
  return authzActivateUser(userId, options);
}

/**
 * Deactivate an active user
 */
export async function deactivateUser(userId: string, accessToken?: string): Promise<AuthzUser> {
  const options = getAuthOptions(accessToken);
  return authzDeactivateUser(userId, options);
}

/**
 * Reactivate a deactivated user
 */
export async function reactivateUser(userId: string, accessToken?: string): Promise<AuthzUser> {
  const options = getAuthOptions(accessToken);
  return authzReactivateUser(userId, options);
}

/**
 * List users with pagination
 */
export async function listUsers(
  params?: ListUsersParams,
  accessToken?: string
): Promise<UserListResponse> {
  const options = getAuthOptions(accessToken);
  return authzListUsers(params || {}, options);
}

/**
 * Validate that a string is a valid UUID format
 */
function validateUserId(userId: string | null | undefined): string {
  if (!userId) {
    throw new Error('User ID is required');
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error(`Invalid user ID format: ${userId}`);
  }
  return userId;
}

/**
 * Get a single user by ID
 */
export async function getUser(userId: string, accessToken?: string): Promise<AuthzUser | null> {
  const validatedUserId = validateUserId(userId);
  const options = getAuthOptions(accessToken);
  return authzGetUser(validatedUserId, options);
}

/**
 * Get a user by email address
 * Returns null if user not found
 */
export async function getUserByEmail(email: string, accessToken?: string): Promise<AuthzUser | null> {
  const options = getAuthOptions(accessToken);
  return authzGetUserByEmail(email, options);
}

/**
 * Add a role to a user
 */
export async function addUserRole(
  userId: string,
  roleId: string,
  accessToken?: string
): Promise<void> {
  const options = getAuthOptions(accessToken);
  return authzAddUserRole(userId, roleId, options);
}

/**
 * Remove a role from a user
 */
export async function removeUserRole(
  userId: string,
  roleId: string,
  accessToken?: string
): Promise<void> {
  const options = getAuthOptions(accessToken);
  return authzRemoveUserRole(userId, roleId, options);
}

// ============================================================================
// Convenience Helpers
// ============================================================================

/**
 * Check if user is active.
 *
 * Fetches the user from authz and checks their status field.
 *
 * @param userId - User ID to check
 * @param accessToken - Access token (JWT) for the authz call
 */
export async function isUserActive(userId: string, accessToken?: string): Promise<boolean> {
  try {
    const user = await getUser(userId, accessToken);
    return user?.status === 'ACTIVE';
  } catch (error) {
    console.error('[USER-MGMT] Error checking user status:', error);
    return false;
  }
}

/**
 * Get user with roles from authz service, returned in a
 * presentation-friendly shape with Date objects.
 *
 * @param userId - User ID (UUID)
 * @param accessToken - Access token (JWT) for the authz call
 */
export async function getUserWithRoles(userId: string, accessToken?: string) {
  try {
    const validatedId = validateUserId(userId);
    const user = await getUser(validatedId, accessToken);

    if (!user) {
      console.warn(`[USER-MGMT] getUser returned null for userId: ${userId}`);
      return null;
    }

    return {
      id: userId,
      email: user.email,
      status: user.status,
      lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : null,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
      roles: user.roles || [],
    };
  } catch (error) {
    console.error(`[USER-MGMT] Error getting user with roles for userId ${userId}:`, error);
    return null;
  }
}
