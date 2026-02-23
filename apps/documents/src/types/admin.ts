/**
 * Admin Panel Types
 */

import type { AppType, UserStatus } from './index';

// ============================================================================
// User Management Types
// ============================================================================

export type UserListItem = {
  id: string;
  email: string;
  status: UserStatus;
  roles: string[];
  lastLoginAt: Date | null;
  createdAt: Date;
};

export type UserCreateRequest = {
  email: string;
  roleIds?: string[];
};

export type UserUpdateRequest = {
  status?: UserStatus;
};

export type UserRoleAssignment = {
  userId: string;
  roleId: string;
  assignedBy: string;
};

// ============================================================================
// Role Management Types
// ============================================================================

export type RoleListItem = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  appCount: number;
  createdAt: Date;
};

export type RoleCreateRequest = {
  name: string;
  description?: string;
};

export type RoleUpdateRequest = {
  name?: string;
  description?: string;
};

export type RoleDetail = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  users: {
    id: string;
    email: string;
    assignedAt: Date;
  }[];
  apps: {
    id: string;
    name: string;
    type: AppType;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

// ============================================================================
// App Management Types
// ============================================================================

export type AppListItem = {
  id: string;
  name: string;
  description: string | null;
  type: AppType;
  url: string | null;
  isActive: boolean;
  displayOrder: number;
  roleCount: number;
  createdAt: Date;
};

export type AppCreateRequest = {
  name: string;
  description?: string;
  type: AppType;
  url?: string;
  iconUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
  oauthClientSecret?: string; // For EXTERNAL apps
};

export type AppUpdateRequest = {
  name?: string;
  description?: string;
  url?: string;
  iconUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
  oauthClientSecret?: string;
};

export type AppDetail = {
  id: string;
  name: string;
  description: string | null;
  type: AppType;
  url: string | null;
  iconUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  oauthClientSecret: string | null;
  roles: {
    id: string;
    name: string;
    userCount: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

// ============================================================================
// Permission Management Types
// ============================================================================

export type PermissionGrant = {
  roleId: string;
  appId: string;
};

export type PermissionRevoke = {
  roleId: string;
  appId: string;
};

export type PermissionMatrix = {
  roles: {
    id: string;
    name: string;
  }[];
  apps: {
    id: string;
    name: string;
    type: AppType;
  }[];
  permissions: {
    roleId: string;
    appId: string;
    granted: boolean;
  }[];
};

// ============================================================================
// Audit Log Display Types
// ============================================================================

export type AuditLogDisplay = {
  id: string;
  eventType: string;
  eventTypeLabel: string;
  userEmail: string | null;
  action: string;
  targetUserEmail?: string | null;
  targetRoleName?: string | null;
  targetAppName?: string | null;
  details: Record<string, unknown> | null;
  success: boolean;
  errorMessage: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

// ============================================================================
// Admin Dashboard Stats
// ============================================================================

export type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  deactivatedUsers: number;
  totalRoles: number;
  totalApps: number;
  activeApps: number;
  recentLogins: number; // Last 24 hours
  failedLogins: number; // Last 24 hours
};

