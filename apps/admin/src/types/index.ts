/**
 * Shared TypeScript Types and Interfaces
 * 
 * All models have been migrated away from Prisma. Types are now defined locally.
 */

// ============================================================================
// Enums (migrated from Prisma)
// ============================================================================

export const AppType = {
  BUILT_IN: 'BUILT_IN',
  LIBRARY: 'LIBRARY',
  EXTERNAL: 'EXTERNAL',
  INTERNAL: 'INTERNAL',
} as const;
export type AppType = (typeof AppType)[keyof typeof AppType];

export const VideoStatus = {
  QUEUED: 'QUEUED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;
export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];

export const VideoVisibility = {
  PRIVATE: 'PRIVATE',
  PUBLIC: 'PUBLIC',
  SHARED: 'SHARED',
} as const;
export type VideoVisibility = (typeof VideoVisibility)[keyof typeof VideoVisibility];

export const DeploymentStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
} as const;
export type DeploymentStatus = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

export const DeploymentEnvironment = {
  PRODUCTION: 'PRODUCTION',
  STAGING: 'STAGING',
} as const;
export type DeploymentEnvironment = (typeof DeploymentEnvironment)[keyof typeof DeploymentEnvironment];

export const DeploymentType = {
  RELEASE: 'RELEASE',
  BRANCH: 'BRANCH',
} as const;
export type DeploymentType = (typeof DeploymentType)[keyof typeof DeploymentType];

export const SecretType = {
  DATABASE_URL: 'DATABASE_URL',
  API_KEY: 'API_KEY',
  JWT_SECRET: 'JWT_SECRET',
  OAUTH_SECRET: 'OAUTH_SECRET',
  CUSTOM: 'CUSTOM',
} as const;
export type SecretType = (typeof SecretType)[keyof typeof SecretType];

export const MessageRole = {
  user: 'user',
  assistant: 'assistant',
  system: 'system',
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const ShareRole = {
  viewer: 'viewer',
  editor: 'editor',
} as const;
export type ShareRole = (typeof ShareRole)[keyof typeof ShareRole];

// ============================================================================
// App Type (migrated from Prisma model)
// ============================================================================

export type App = {
  id: string;
  name: string;
  description: string | null;
  type: AppType;
  url: string | null;
  deployedPath: string | null;
  iconUrl: string | null;
  selectedIcon: string | null;
  displayOrder: number;
  isActive: boolean;
  healthEndpoint: string | null;
  oauthClientSecret: string | null;
  githubToken: string | null;
  githubRepo: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastDeploymentId: string | null;
  lastDeploymentStatus: string | null;
};

// ============================================================================
// OAuthToken Type (legacy, kept for backward compatibility)
// ============================================================================

export type OAuthToken = {
  id: string;
  jti: string;
  userId: string;
  appId: string | null;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  ipAddress: string | null;
  createdAt: Date;
};

// ============================================================================
// Audit Event Type (migrated from Prisma to simple string union)
// ============================================================================

// Re-export from audit module for backward compatibility
export type { AuditEventType } from '@jazzmind/busibox-app/lib/authz/audit';

// ============================================================================
// User Status Type (migrated from Prisma to simple string union)
// ============================================================================

export type UserStatus = 'PENDING' | 'ACTIVE' | 'DEACTIVATED';

// ============================================================================
// Composite Types with Relations (updated for authz migration)
// ============================================================================

/**
 * User type - now fetched from authz service, not Prisma
 */
export type User = {
  id: string;
  email: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
  emailVerifiedAt?: Date | null;
  pendingExpiresAt?: Date | null;
  idpProvider?: string | null;
  idpTenantId?: string | null;
  idpObjectId?: string | null;
  idpRoles?: string[] | null;
  idpGroups?: string[] | null;
};

/**
 * Role type - now fetched from authz service, not Prisma
 */
export type Role = {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  scopes: string[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * User with roles (from authz service)
 */
export type UserWithRoles = User & {
  roles: Role[];
};

/**
 * Role with app permissions (from authz role bindings)
 */
export type RoleWithPermissions = Role & {
  appPermissions: {
    appId: string;
    app?: App;
  }[];
};

/**
 * App with role permissions (from authz role bindings)
 */
export type AppWithPermissions = App & {
  rolePermissions: {
    roleId: string;
    roleName: string;
  }[];
};

// ============================================================================
// Permission Checking
// ============================================================================

export type PermissionCheck = {
  userId: string;
  appId: string;
  hasAccess: boolean;
  roles: string[];
};

// ============================================================================
// Dashboard Types
// ============================================================================

export type NavigationItem = {
  href: string;
  label: string;
};

export type DashboardApp = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  url: string | null;
  iconUrl: string | null;
  selectedIcon: string | null;
  displayOrder: number;
  isActive: boolean;
};

export type UserProfile = {
  id: string;
  email: string;
  status: string;
  roles: string[];
  lastLoginAt: Date | null;
  createdAt: Date;
};

// ============================================================================
// Audit Log Types
// ============================================================================

export type AuditLogEntry = {
  id: string;
  eventType: string;
  userId: string | null;
  userEmail?: string | null;
  action: string;
  details: Record<string, unknown> | null;
  success: boolean;
  errorMessage: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

// ============================================================================
// Pagination Types
// ============================================================================

export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
};

// ============================================================================
// Filter Types
// ============================================================================

export type UserFilter = {
  status?: string;
  search?: string;
  roleId?: string;
};

export type AuditLogFilter = {
  eventType?: string;
  userId?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
};
