/**
 * API Request/Response Types
 */

// ============================================================================
// Generic API Response Types
// ============================================================================

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type ApiError = {
  success: false;
  error: string;
  statusCode?: number;
  details?: Record<string, unknown>;
};

// ============================================================================
// SSO API Types
// ============================================================================

export type SSOTokenRequest = {
  userId: string;
  appId: string;
};

export type SSOTokenResponse = {
  success: boolean;
  token?: string;
  expiresAt?: Date;
  appUrl?: string;
  error?: string;
};

export type SSOTokenValidation = {
  token: string;
  appId: string;
  clientSecret: string;
};

export type SSOTokenValidationResponse = {
  success: boolean;
  userId?: string;
  userEmail?: string;
  roles?: string[];
  appName?: string;
  expiresAt?: Date;
  error?: string;
};

// ============================================================================
// Dashboard API Types
// ============================================================================

export type DashboardResponse = {
  user: {
    id: string;
    email: string;
    roles: string[];
  };
  apps: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    url: string | null;
    iconUrl: string | null;
    displayOrder: number;
  }[];
};

// ============================================================================
// Pagination Types
// ============================================================================

export type PaginationParams = {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type PaginatedResponse<T> = {
  success: boolean;
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
// Validation Types
// ============================================================================

export type ValidationError = {
  field: string;
  message: string;
};

export type ValidationResponse = {
  success: false;
  error: string;
  validationErrors?: ValidationError[];
};

