/**
 * Authentication-related Types
 */

// ============================================================================
// Magic Link Types
// ============================================================================

export type MagicLinkRequest = {
  email: string;
};

export type MagicLinkResponse = {
  success: boolean;
  message: string;
  email?: string;
};

export type MagicLinkVerification = {
  token: string;
};

export type MagicLinkVerificationResult = {
  success: boolean;
  userId?: string;
  sessionToken?: string;
  error?: string;
};

// ============================================================================
// Session Types
// ============================================================================

export type SessionData = {
  userId: string;
  email: string;
  roles: string[];
  status: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  favoriteColor?: string;
  expiresAt: Date;
};

export type SessionValidation = {
  isValid: boolean;
  session?: SessionData;
  error?: string;
};

// ============================================================================
// Login/Logout Types
// ============================================================================

export type LoginResult = {
  success: boolean;
  sessionToken?: string;
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
  error?: string;
};

export type LogoutResult = {
  success: boolean;
  message: string;
};

// ============================================================================
// Auth Middleware Types
// ============================================================================

export type AuthenticatedUser = {
  id: string;
  email: string;
  status: string;
  roles: string[];
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  favoriteColor?: string;
};

export type AuthContext = {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
};

// ============================================================================
// Better Auth Types
// ============================================================================

export type BetterAuthSession = {
  session: {
    userId: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
  };
};

