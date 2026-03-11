/**
 * Lib exports - organized by busibox service
 */

// Agent service
export * from './agent';

// AuthZ service (auth, RBAC, SSO, audit, tokens, passkeys, user management)
export * from './authz';

// HTTP utilities
export * from './http/fetch-with-fallback';

// Data service (documents, embeddings, libraries)
export * from './data';

// RBAC - rename User to RbacUser to avoid conflict with types/User
export {
  listRoles,
  getRole,
  getRoleByName,
  listUsers,
  getAllUsers,
  getUser,
  getUserByEmail,
  getUserRoles,
  getUserRoleNames,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  isAdmin,
  isGuest,
  createRole,
  updateRole,
  deleteRole,
  addUserRole,
  removeUserRole,
  deleteUser,
  createUser,
  updateUser,
  activateUser,
  deactivateUser,
  reactivateUser,
  listEmailDomains,
  addEmailDomain,
  removeEmailDomain,
  createRoleBinding,
  getRoleBinding,
  deleteRoleBinding,
  listRoleBindings,
  getRoleResourceBindings,
  getResourceRoles,
  userCanAccessResource,
  getUserAccessibleResources,
  grantRoleResourceAccess,
  revokeRoleResourceAccess,
} from './authz/rbac';
export type {
  RbacClientOptions,
  AdminAuthOptions,
  Role,
  User as RbacUser,
  UserListResponse,
  CreateUserParams,
  UpdateUserParams,
  ListUsersParams,
  EmailDomainRule,
  ResourceType,
  RoleBinding,
  RoleWithBinding,
  CreateRoleBindingParams,
  ListRoleBindingsParams,
} from './authz/rbac';

// Config service (config-api client)
export * from './config';

// Icons
export * from './icons';

// Hooks
export * from './hooks/useIsMobile';
export * from './hooks/useAutosave';

// Media (video upload/expiration - client-safe)
export * from './media/upload';
export * from './media/expiration';
