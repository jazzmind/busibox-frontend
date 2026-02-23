/**
 * Shared types for @jazzmind/busibox-app components
 */

export type User = {
  id: string;
  email: string;
  status: string;
  roles?: string[];
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  favoriteColor?: string;
};

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  favoriteColor?: string;
}

export type SessionData = {
  user: User | null;
  isAuthenticated: boolean;
  refreshSession?: () => Promise<void>;
};

// Export all workflow types
export * from './workflow';

// Export library and data document types
export * from './library';
export * from './data-documents';