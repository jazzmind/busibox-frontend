import type { Library } from '@jazzmind/busibox-app/lib/data/libraries';
import type { Role } from '@jazzmind/busibox-app';

// Minimal Document type for backward compatibility
interface Document {
  id: string;
  userId: string;
  filename: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
  libraryId: string | null;
  visibility: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

/**
 * Role interface for library types (subset of authz Role)
 */
interface RoleSummary {
  id: string;
  name: string;
  description?: string | null;
}

/**
 * User interface for library types (subset of authz User)
 */
interface UserSummary {
  id: string;
  email: string;
}

export interface LibraryWithDetails extends Library {
  role: RoleSummary | null;
  roles?: RoleSummary[];
  creator?: UserSummary;
  _count?: {
    documents: number;
  };
}

export interface LibrarySidebarItem {
  id: string;
  name: string;
  isPersonal: boolean;
  documentCount: number;
  role?: RoleSummary | null;
  roles?: RoleSummary[];
}

export interface TagGroup {
  name: string;
  tags: string[];
  documentCount: number;
  confidence?: number;
}

export interface DocumentWithUser extends Document {
  user: { email: string };
}
