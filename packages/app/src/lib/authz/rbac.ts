/**
 * RBAC Client for busibox-app
 * 
 * Centralized RBAC client that queries the authz service.
 * All Busibox applications should use this client for role/permission checks.
 * 
 * Authentication:
 * - For self-service operations (user checking own access), pass the session JWT
 *   as `accessToken` - authz accepts it directly, no token exchange required.
 * - For admin operations (accessing other users' data), use an exchanged access
 *   token with appropriate authz.bindings.* scopes.
 * 
 * Usage:
 * ```typescript
 * import { hasRole, isAdmin, getUserRoles, getUserAccessibleResources } from 'busibox-app';
 * 
 * // Self-service: pass session JWT directly
 * const resources = await getUserAccessibleResources(userId, 'app', {
 *   authzUrl: 'http://authz-api:8010',
 *   accessToken: sessionJwt,
 * });
 * 
 * // Admin: use exchanged access token with scopes
 * const roles = await getUserRoles('other-user-123', {
 *   accessToken: adminAccessToken,
 * });
 * ```
 */

// Default to production authz service
// For test environment, set AUTHZ_BASE_URL to your authz service URL
const DEFAULT_AUTHZ_URL = process.env.AUTHZ_BASE_URL || process.env.AUTHZ_URL || 'http://authz-api:8010';

export interface RbacClientOptions {
  /** User ID (for server-side token acquisition) */
  userId?: string;
  /** Custom token acquisition function */
  getAuthzToken?: (userId: string, audience: string, scopes: string[]) => Promise<string>;
  /** Override authz service URL */
  authzUrl?: string;
  /**
   * Access token (JWT) for authentication.
   * 
   * For self-service operations (user accessing their own resources),
   * you can pass the session JWT directly - authz accepts it.
   * 
   * For admin operations (accessing other users' resources),
   * use an exchanged access token with authz.bindings.* scopes.
   */
  accessToken?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  scopes?: string[];
  is_system?: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  /** User ID (returned as 'id' from authz API) */
  id: string;
  /** @deprecated Use 'id' instead. Alias for backwards compatibility. */
  user_id?: string;
  email: string;
  status?: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  email_verified_at?: string | null;
  last_login_at?: string | null;
  pending_expires_at?: string | null;
  roles: Role[];
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
  };
}

export interface CreateUserParams {
  email: string;
  role_ids?: string[];
  status?: 'PENDING' | 'ACTIVE' | 'DEACTIVATED';
  assigned_by?: string;
}

export interface UpdateUserParams {
  email?: string;
  status?: 'PENDING' | 'ACTIVE' | 'DEACTIVATED';
  display_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  email_verified_at?: string;
  last_login_at?: string;
  pending_expires_at?: string;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  status?: 'PENDING' | 'ACTIVE' | 'DEACTIVATED';
  search?: string;
}

/**
 * Admin options type - Zero Trust with optional access token.
 * 
 * For protected endpoints, accessToken should be provided (obtained via token exchange).
 * Some endpoints may be public (e.g., role lookups for session validation).
 */
export type AdminAuthOptions = RbacClientOptions;

/**
 * Get authorization header for RBAC API calls.
 * Zero Trust: Uses access token (JWT) for authentication.
 */
async function getAuthHeader(options: RbacClientOptions): Promise<string | undefined> {
  // Zero Trust: Access token (JWT) takes precedence
  if (options.accessToken) {
    return `Bearer ${options.accessToken}`;
  }

  // Server-side: use custom token acquisition
  if (options.getAuthzToken && options.userId) {
    const token = await options.getAuthzToken(options.userId, 'authz', []);
    return `Bearer ${token}`;
  }

  // No authentication provided - some endpoints are public (e.g., role lookups)
  return undefined;
}

/**
 * Fetch from authz service with error handling
 */
async function authzFetch(
  path: string,
  options: RbacClientOptions & RequestInit
): Promise<Response> {
  const { userId, getAuthzToken, authzUrl, accessToken, ...fetchOptions } = options;
  const baseUrl = authzUrl || DEFAULT_AUTHZ_URL;
  const url = `${baseUrl}${path}`;

  const authHeader = await getAuthHeader({ userId, getAuthzToken, accessToken });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AuthZ RBAC error (${response.status}): ${errorText}`);
  }

  return response;
}

// ============================================================================
// Role Query Functions
// ============================================================================

/**
 * Get all roles from authz service
 */
export async function listRoles(options: RbacClientOptions = {}): Promise<Role[]> {
  try {
    const response = await authzFetch('/admin/roles', options);
    return await response.json();
  } catch (error) {
    console.error('[RBAC] Failed to list roles:', error);
    return [];
  }
}

/**
 * Get a specific role by ID
 */
export async function getRole(roleId: string, options: RbacClientOptions = {}): Promise<Role | null> {
  try {
    const response = await authzFetch(`/admin/roles/${roleId}`, options);
    return await response.json();
  } catch (error) {
    console.error('[RBAC] Failed to get role:', error);
    return null;
  }
}

/**
 * Get a role by name
 */
export async function getRoleByName(roleName: string, options: RbacClientOptions = {}): Promise<Role | null> {
  try {
    const roles = await listRoles(options);
    return roles.find(r => r.name === roleName) || null;
  } catch (error) {
    console.error('[RBAC] Failed to get role by name:', error);
    return null;
  }
}

// ============================================================================
// User Query Functions
// ============================================================================

/**
 * List users with pagination and filtering
 */
export async function listUsers(
  params: ListUsersParams = {},
  options: RbacClientOptions = {}
): Promise<UserListResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.status) queryParams.set('status', params.status);
    if (params.search) queryParams.set('search', params.search);
    
    const queryString = queryParams.toString();
    const path = `/admin/users${queryString ? `?${queryString}` : ''}`;
    
    const response = await authzFetch(path, options);
    return await response.json();
  } catch (error) {
    console.error('[RBAC] Failed to list users:', error);
    return { users: [], pagination: { page: 1, limit: 20, total_count: 0, total_pages: 0 } };
  }
}

/**
 * Get all users (convenience function that pages through all results)
 */
export async function getAllUsers(options: RbacClientOptions = {}): Promise<User[]> {
  const allUsers: User[] = [];
  let page = 1;
  const limit = 100;
  
  while (true) {
    const result = await listUsers({ page, limit }, options);
    allUsers.push(...result.users);
    
    if (page >= result.pagination.total_pages) {
      break;
    }
    page++;
  }
  
  return allUsers;
}

/**
 * Get a specific user by ID (includes roles)
 */
export async function getUser(userId: string, options: RbacClientOptions = {}): Promise<User | null> {
  try {
    const response = await authzFetch(`/admin/users/${userId}`, options);
    return await response.json();
  } catch (error) {
    console.error('[RBAC] Failed to get user:', error);
    return null;
  }
}

/**
 * Get a user by email address (includes roles)
 * Returns null if user not found.
 */
export async function getUserByEmail(email: string, options: RbacClientOptions = {}): Promise<User | null> {
  try {
    const response = await authzFetch(`/admin/users/by-email/${encodeURIComponent(email)}`, options);
    return await response.json();
  } catch (error) {
    // 404 means user not found - not an error
    return null;
  }
}

/**
 * Get user's roles
 */
export async function getUserRoles(userId: string, options: RbacClientOptions = {}): Promise<Role[]> {
  try {
    const user = await getUser(userId, options);
    return user?.roles || [];
  } catch (error) {
    console.error('[RBAC] Failed to get user roles:', error);
    return [];
  }
}

/**
 * Get user's role names
 */
export async function getUserRoleNames(userId: string, options: RbacClientOptions = {}): Promise<string[]> {
  const roles = await getUserRoles(userId, options);
  return roles.map(r => r.name);
}

// ============================================================================
// Permission Check Functions
// ============================================================================

/**
 * Check if user has a specific role
 */
export async function hasRole(
  userId: string,
  roleName: string,
  options: RbacClientOptions = {}
): Promise<boolean> {
  try {
    const roles = await getUserRoles(userId, options);
    return roles.some(r => r.name === roleName);
  } catch (error) {
    console.error('[RBAC] Failed to check role:', error);
    return false;
  }
}

/**
 * Check if user has any of the specified roles
 */
export async function hasAnyRole(
  userId: string,
  roleNames: string[],
  options: RbacClientOptions = {}
): Promise<boolean> {
  try {
    const roles = await getUserRoles(userId, options);
    const userRoleNames = roles.map(r => r.name);
    return roleNames.some(roleName => userRoleNames.includes(roleName));
  } catch (error) {
    console.error('[RBAC] Failed to check roles:', error);
    return false;
  }
}

/**
 * Check if user has all of the specified roles
 */
export async function hasAllRoles(
  userId: string,
  roleNames: string[],
  options: RbacClientOptions = {}
): Promise<boolean> {
  try {
    const roles = await getUserRoles(userId, options);
    const userRoleNames = roles.map(r => r.name);
    return roleNames.every(roleName => userRoleNames.includes(roleName));
  } catch (error) {
    console.error('[RBAC] Failed to check roles:', error);
    return false;
  }
}

/**
 * Check if user is an admin
 */
export async function isAdmin(userId: string, options: RbacClientOptions = {}): Promise<boolean> {
  return hasRole(userId, 'Admin', options);
}

/**
 * Check if user is a guest
 */
export async function isGuest(userId: string, options: RbacClientOptions = {}): Promise<boolean> {
  return hasRole(userId, 'Guest', options);
}

// ============================================================================
// Role Management Functions (Admin Only)
// ============================================================================

/**
 * Create a new role (requires admin token)
 * 
 * @param name - Role name
 * @param description - Optional description
 * @param scopes - Optional OAuth scopes for this role (e.g. ['data.read', 'search.write'])
 * @param options - RBAC client options with adminToken
 */
export async function createRole(
  name: string,
  description: string | null,
  options: AdminAuthOptions,
  scopes?: string[]
): Promise<Role> {
  const response = await authzFetch('/admin/roles', {
    ...options,
    method: 'POST',
    body: JSON.stringify({ name, description, scopes: scopes || [] }),
  });
  return await response.json();
}

/**
 * Update a role (requires admin token)
 * 
 * @param roleId - Role UUID
 * @param updates - Fields to update (name, description, scopes)
 * @param options - RBAC client options with adminToken
 */
export async function updateRole(
  roleId: string,
  updates: { name?: string; description?: string | null; scopes?: string[] },
  options: AdminAuthOptions
): Promise<Role> {
  const response = await authzFetch(`/admin/roles/${roleId}`, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return await response.json();
}

/**
 * Delete a role (requires admin token)
 */
export async function deleteRole(
  roleId: string,
  options: AdminAuthOptions
): Promise<void> {
  await authzFetch(`/admin/roles/${roleId}`, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * Add a role to a user (requires admin token)
 */
export async function addUserRole(
  userId: string,
  roleId: string,
  options: AdminAuthOptions
): Promise<void> {
  await authzFetch(`/admin/users/${userId}/roles/${roleId}`, {
    ...options,
    method: 'POST',
  });
}

/**
 * Remove a role from a user (requires admin token)
 */
export async function removeUserRole(
  userId: string,
  roleId: string,
  options: AdminAuthOptions
): Promise<void> {
  await authzFetch(`/admin/users/${userId}/roles/${roleId}`, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * Delete a user (requires admin token)
 */
export async function deleteUser(
  userId: string,
  options: AdminAuthOptions
): Promise<void> {
  await authzFetch(`/admin/users/${userId}`, {
    ...options,
    method: 'DELETE',
  });
}

// ============================================================================
// User Management Functions (Admin Only)
// ============================================================================

/**
 * Create a new user (requires admin token)
 */
export async function createUser(
  params: CreateUserParams,
  options: AdminAuthOptions
): Promise<User> {
  const response = await authzFetch('/admin/users', {
    ...options,
    method: 'POST',
    body: JSON.stringify(params),
  });
  return await response.json();
}

/**
 * Update a user (requires admin token)
 */
export async function updateUser(
  userId: string,
  updates: UpdateUserParams,
  options: AdminAuthOptions
): Promise<User> {
  const response = await authzFetch(`/admin/users/${userId}`, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return await response.json();
}

/**
 * Activate a pending user (requires admin token)
 */
export async function activateUser(
  userId: string,
  options: AdminAuthOptions
): Promise<User> {
  const response = await authzFetch(`/admin/users/${userId}/activate`, {
    ...options,
    method: 'POST',
  });
  return await response.json();
}

/**
 * Deactivate an active user (requires admin token)
 */
export async function deactivateUser(
  userId: string,
  options: AdminAuthOptions
): Promise<User> {
  const response = await authzFetch(`/admin/users/${userId}/deactivate`, {
    ...options,
    method: 'POST',
  });
  return await response.json();
}

/**
 * Reactivate a deactivated user (requires admin token)
 */
export async function reactivateUser(
  userId: string,
  options: AdminAuthOptions
): Promise<User> {
  const response = await authzFetch(`/admin/users/${userId}/reactivate`, {
    ...options,
    method: 'POST',
  });
  return await response.json();
}

// ============================================================================
// Email Domain Configuration (Admin Only)
// ============================================================================

export interface EmailDomainRule {
  id: string;
  domain: string;
  is_allowed: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * List email domain rules (requires admin token)
 */
export async function listEmailDomains(
  options: AdminAuthOptions
): Promise<EmailDomainRule[]> {
  const response = await authzFetch('/admin/email-domains', options);
  const result = await response.json();
  return result.domains || [];
}

/**
 * Add or update an email domain rule (requires admin token)
 */
export async function addEmailDomain(
  domain: string,
  isAllowed: boolean,
  options: AdminAuthOptions
): Promise<EmailDomainRule> {
  const response = await authzFetch('/admin/email-domains', {
    ...options,
    method: 'POST',
    body: JSON.stringify({ domain, is_allowed: isAllowed }),
  });
  return await response.json();
}

/**
 * Remove an email domain rule (requires admin token)
 */
export async function removeEmailDomain(
  domain: string,
  options: AdminAuthOptions
): Promise<void> {
  await authzFetch(`/admin/email-domains/${encodeURIComponent(domain)}`, {
    ...options,
    method: 'DELETE',
  });
}

// =============================================================================
// Role Bindings
// =============================================================================

export type ResourceType = 'app' | 'library' | 'document';

export interface RoleBinding {
  id: string;
  role_id: string;
  resource_type: ResourceType;
  resource_id: string;
  permissions?: Record<string, boolean>;
  created_at: string;
  created_by?: string | null;
}

export interface RoleWithBinding {
  id: string;
  name: string;
  description?: string | null;
  scopes?: string[];
  binding_id: string;
  permissions?: Record<string, boolean>;
  binding_created_at: string;
}

export interface CreateRoleBindingParams {
  role_id: string;
  resource_type: ResourceType;
  resource_id: string;
  permissions?: Record<string, boolean>;
}

export interface ListRoleBindingsParams {
  role_id?: string;
  resource_type?: ResourceType;
  resource_id?: string;
  limit?: number;
  offset?: number;
}

/**
 * Create a new role-resource binding (requires admin token)
 */
export async function createRoleBinding(
  params: CreateRoleBindingParams,
  options: AdminAuthOptions
): Promise<RoleBinding> {
  const response = await authzFetch('/admin/bindings', {
    ...options,
    method: 'POST',
    body: JSON.stringify(params),
  });
  return await response.json();
}

/**
 * Get a role binding by ID (requires admin token)
 */
export async function getRoleBinding(
  bindingId: string,
  options: AdminAuthOptions
): Promise<RoleBinding | null> {
  try {
    const response = await authzFetch(`/admin/bindings/${bindingId}`, options);
    return await response.json();
  } catch (error) {
    console.error('[RBAC] Failed to get role binding:', error);
    return null;
  }
}

/**
 * Delete a role binding by ID (requires admin token)
 */
export async function deleteRoleBinding(
  bindingId: string,
  options: AdminAuthOptions
): Promise<void> {
  await authzFetch(`/admin/bindings/${bindingId}`, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * List role bindings with optional filters (requires admin token)
 */
export async function listRoleBindings(
  params: ListRoleBindingsParams = {},
  options: AdminAuthOptions
): Promise<RoleBinding[]> {
  const searchParams = new URLSearchParams();
  if (params.role_id) searchParams.set('role_id', params.role_id);
  if (params.resource_type) searchParams.set('resource_type', params.resource_type);
  if (params.resource_id) searchParams.set('resource_id', params.resource_id);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));

  const queryString = searchParams.toString();
  const url = queryString ? `/admin/bindings?${queryString}` : '/admin/bindings';
  
  const response = await authzFetch(url, options);
  return await response.json();
}

/**
 * Get all bindings for a specific role (requires admin token)
 */
export async function getRoleResourceBindings(
  roleId: string,
  resourceType?: ResourceType,
  options?: AdminAuthOptions
): Promise<RoleBinding[]> {
  if (!options) {
    throw new Error('Admin token is required for getRoleResourceBindings');
  }
  
  const searchParams = new URLSearchParams();
  if (resourceType) searchParams.set('resource_type', resourceType);
  
  const queryString = searchParams.toString();
  const url = queryString 
    ? `/roles/${roleId}/bindings?${queryString}` 
    : `/roles/${roleId}/bindings`;
  
  const response = await authzFetch(url, options);
  return await response.json();
}

/**
 * Get all roles that have access to a specific resource (requires admin token)
 */
export async function getResourceRoles(
  resourceType: ResourceType,
  resourceId: string,
  options: AdminAuthOptions
): Promise<RoleWithBinding[]> {
  const response = await authzFetch(
    `/resources/${resourceType}/${resourceId}/roles`,
    options
  );
  return await response.json();
}

/**
 * Check if a user can access a specific resource (requires admin token)
 */
export async function userCanAccessResource(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  options: AdminAuthOptions
): Promise<boolean> {
  const response = await authzFetch(
    `/users/${userId}/can-access/${resourceType}/${resourceId}`,
    options
  );
  const result = await response.json();
  return result.has_access === true;
}

/**
 * Get all resource IDs of a given type that a user can access (requires admin token)
 */
export async function getUserAccessibleResources(
  userId: string,
  resourceType: ResourceType,
  options: AdminAuthOptions
): Promise<string[]> {
  const response = await authzFetch(
    `/users/${userId}/resources/${resourceType}`,
    options
  );
  const result = await response.json();
  return result.resource_ids || [];
}

/**
 * Helper: Grant a role access to a resource (creates binding)
 * Convenience wrapper around createRoleBinding
 */
export async function grantRoleResourceAccess(
  roleId: string,
  resourceType: ResourceType,
  resourceId: string,
  permissions?: Record<string, boolean>,
  options?: AdminAuthOptions
): Promise<RoleBinding> {
  if (!options) {
    throw new Error('Admin token is required for grantRoleResourceAccess');
  }
  return createRoleBinding(
    { role_id: roleId, resource_type: resourceType, resource_id: resourceId, permissions },
    options
  );
}

/**
 * Helper: Revoke a role's access to a resource (deletes binding)
 * Finds and deletes the binding for the given role/resource combo
 */
export async function revokeRoleResourceAccess(
  roleId: string,
  resourceType: ResourceType,
  resourceId: string,
  options: AdminAuthOptions
): Promise<boolean> {
  // Find the binding first
  const bindings = await listRoleBindings(
    { role_id: roleId, resource_type: resourceType, resource_id: resourceId },
    options
  );
  
  if (bindings.length === 0) {
    return false; // No binding to delete
  }
  
  await deleteRoleBinding(bindings[0].id, options);
  return true;
}


