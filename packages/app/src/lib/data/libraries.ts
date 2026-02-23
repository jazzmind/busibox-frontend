import {
  getUserRoles,
  hasRole,
  userCanAccessResource,
  getUserAccessibleResources,
  getResourceRoles,
  type RoleWithBinding,
} from '@jazzmind/busibox-app';
import { getAuthzOptions, exchangeWithSubjectToken } from '../authz/next-client';
import { getDataApiUrl } from '../next/api-url';

// Personal library type constants for convenience
type PersonalLibraryType = 'DOCS' | 'RESEARCH' | 'TASKS' | 'MEDIA' | 'CUSTOM';

export const PersonalLibraryTypes = {
  DOCS: 'DOCS' as PersonalLibraryType,
  RESEARCH: 'RESEARCH' as PersonalLibraryType,
  TASKS: 'TASKS' as PersonalLibraryType,
  MEDIA: 'MEDIA' as PersonalLibraryType,
  CUSTOM: 'CUSTOM' as PersonalLibraryType,
} as const;

// Library display names by type (CUSTOM uses library name from API)
export const PersonalLibraryNames: Record<Exclude<PersonalLibraryType, 'CUSTOM'>, string> = {
  DOCS: 'Personal',
  RESEARCH: 'Research',
  TASKS: 'Tasks',
  MEDIA: 'Media',
};

/** Fixed types that cannot be deleted; only CUSTOM can be deleted */
export const FIXED_PERSONAL_LIBRARY_TYPES = new Set<PersonalLibraryType>([
  PersonalLibraryTypes.DOCS,
  PersonalLibraryTypes.RESEARCH,
  PersonalLibraryTypes.TASKS,
  PersonalLibraryTypes.MEDIA,
]);

/** True if library is a user-created custom personal library (can be renamed/deleted) */
export function isCustomPersonalLibrary(library: {
  libraryType?: string | null;
  library_type?: string | null;
  isPersonal?: boolean;
  is_personal?: boolean;
}): boolean {
  const libType = library.libraryType ?? library.library_type;
  const isPersonal = library.isPersonal ?? library.is_personal ?? false;
  return !!(isPersonal && libType === PersonalLibraryTypes.CUSTOM);
}

// Library shape returned by data-api
export interface Library {
  id: string;
  name: string;
  description: string | null;
  isPersonal: boolean;
  userId: string | null;
  libraryType: PersonalLibraryType | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// Role info returned with library queries
export interface LibraryRoleInfo {
  id: string;
  name: string;
  description: string | null;
}

export interface LibraryWithRole extends Library {
  role: LibraryRoleInfo | null; // Legacy single role (deprecated)
  roles: LibraryRoleInfo[]; // Multiple roles via authz bindings
  _count: {
    documents: number;
  };
}

// ---------------------------------------------------------------------------
// Internal data-api helpers
// ---------------------------------------------------------------------------

async function exchangeForDataApiToken(
  userId: string,
  sessionJwt: string
): Promise<string> {
  const tokenResponse = await exchangeWithSubjectToken({
    sessionJwt,
    userId,
    audience: 'data-api',
    scopes: ['data:read', 'data:write'],
    purpose: 'library-operations',
  });
  return tokenResponse.accessToken;
}

function toLibrary(raw: any): Library {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description || null,
    isPersonal: raw.isPersonal ?? raw.is_personal ?? false,
    userId: raw.userId || raw.user_id || raw.ownerId || null,
    libraryType: raw.libraryType || raw.library_type || null,
    createdBy: raw.createdBy || raw.created_by || raw.userId || '',
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
    deletedAt: raw.deletedAt ? new Date(raw.deletedAt) : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get or create user's personal library of a specific type via data-api.
 *
 * Data-api provides POST /libraries with isPersonal: true which calls
 * get_or_create_personal_library internally, handling idempotency.
 */
export async function ensurePersonalLibrary(
  userId: string,
  libraryType: PersonalLibraryType = PersonalLibraryTypes.DOCS,
  sessionJwt?: string
): Promise<Library> {
  console.log(`[ensurePersonalLibrary] Looking for ${libraryType} library for user:`, userId);
  let libraryName = 'Personal';
  if (libraryType !== PersonalLibraryTypes.CUSTOM) {
    libraryName = PersonalLibraryNames[libraryType as Exclude<PersonalLibraryType, 'CUSTOM'>];
  }

  if (!sessionJwt) {
    // Without a JWT we can't call data-api authenticated -- use internal header
    const response = await fetch(`${getDataApiUrl()}/libraries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service': 'busibox-portal',
        'X-User-Id': userId,
      },
      body: JSON.stringify({
        name: libraryName,
        isPersonal: true,
        userId,
        libraryType,
        createdBy: userId,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const lib = data.data || data;
      console.log(`[ensurePersonalLibrary] Got/created ${libraryType} library via internal:`, lib.id);
      return toLibrary(lib);
    } else if (response.status === 409) {
      // Already exists -- list and find
      const listResp = await fetch(`${getDataApiUrl()}/libraries`, {
        headers: {
          'X-Internal-Service': 'busibox-portal',
          'X-User-Id': userId,
        },
      });
      if (listResp.ok) {
        const listData = await listResp.json();
        const libs = listData.data || [];
        const match = libs.find((l: any) => (l.libraryType || l.library_type) === libraryType && l.isPersonal);
        if (match) return toLibrary(match);
      }
    }
    throw new Error(`Failed to ensure ${libraryType} library for user ${userId}`);
  }

  // Authenticated path
  const accessToken = await exchangeForDataApiToken(userId, sessionJwt);

  const response = await fetch(`${getDataApiUrl()}/libraries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: libraryName,
      isPersonal: true,
      userId,
      libraryType,
      createdBy: userId,
    }),
  });

  if (response.ok) {
    const data = await response.json();
    const lib = data.data || data;
    console.log(`[ensurePersonalLibrary] Got/created ${libraryType} library:`, lib.id);
    return toLibrary(lib);
  }

  if (response.status === 409) {
    // Already exists -- list and find
    const listResp = await fetch(`${getDataApiUrl()}/libraries?include_shared=false`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    if (listResp.ok) {
      const listData = await listResp.json();
      const libs = listData.data || [];
      const match = libs.find((l: any) => (l.libraryType || l.library_type) === libraryType && l.isPersonal);
      if (match) return toLibrary(match);
    }
  }

  const errorText = await response.text().catch(() => '');
  throw new Error(`Failed to ensure ${libraryType} library: ${response.status} ${errorText}`);
}

/**
 * Convenience function to get or create user's research library.
 * This is where web research results are stored.
 */
export async function ensureResearchLibrary(userId: string, sessionJwt?: string): Promise<Library> {
  return ensurePersonalLibrary(userId, PersonalLibraryTypes.RESEARCH, sessionJwt);
}

/**
 * Convenience function to get or create user's tasks library.
 * This is where agent task outputs are stored.
 */
export async function ensureTasksLibrary(userId: string, sessionJwt?: string): Promise<Library> {
  return ensurePersonalLibrary(userId, PersonalLibraryTypes.TASKS, sessionJwt);
}

/**
 * Get all personal libraries for a user (DOCS, RESEARCH, and TASKS).
 * Creates them if they don't exist.
 */
export async function ensureAllPersonalLibraries(userId: string, sessionJwt?: string): Promise<Library[]> {
  if (sessionJwt) {
    try {
      const accessToken = await exchangeForDataApiToken(userId, sessionJwt);
      const response = await fetch(`${getDataApiUrl()}/libraries/ensure-personal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        return (data.data || []).map(toLibrary);
      }
    } catch (error) {
      console.error('[ensureAllPersonalLibraries] Error calling data-api:', error);
    }
  }

  // Fallback: ensure individually
  const results = await Promise.allSettled([
    ensurePersonalLibrary(userId, PersonalLibraryTypes.DOCS, sessionJwt),
    ensurePersonalLibrary(userId, PersonalLibraryTypes.RESEARCH, sessionJwt),
    ensurePersonalLibrary(userId, PersonalLibraryTypes.TASKS, sessionJwt),
  ]);

  const libraries: Library[] = [];
  results.forEach((result, index) => {
    const type = ['DOCS', 'RESEARCH', 'TASKS'][index];
    if (result.status === 'fulfilled') {
      libraries.push(result.value);
    } else {
      console.error(`[ensureAllPersonalLibraries] Failed to ensure ${type}:`, result.reason);
    }
  });
  return libraries;
}

/**
 * Get user's role IDs from authz service
 */
async function getUserRoleIds(userId: string): Promise<string[]> {
  try {
    const options = getAuthzOptions();
    const roles = await getUserRoles(userId, options);
    return roles.map(r => r.id);
  } catch (error) {
    console.error('[LIBRARIES] Error getting user roles:', error);
    return [];
  }
}

/**
 * Check if user can access a library
 * - Personal library: must be the owner
 * - Shared library: check via authz role bindings
 * 
 * Note: Access check is done by data-api (source of truth for libraries).
 */
export async function canAccessLibrary(
  userId: string,
  libraryId: string,
  sessionJwt?: string
): Promise<boolean> {
  console.log(`[canAccessLibrary] Checking access for user=${userId}, library=${libraryId}, hasJwt=${!!sessionJwt}`);
  
  if (sessionJwt) {
    try {
      const accessToken = await exchangeForDataApiToken(userId, sessionJwt);
      
      console.log(`[canAccessLibrary] Calling data-api: ${getDataApiUrl()}/libraries/${libraryId}`);
      const response = await fetch(`${getDataApiUrl()}/libraries/${libraryId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      console.log(`[canAccessLibrary] Data-api response: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        const library = data.data;
        console.log(`[canAccessLibrary] Library data:`, JSON.stringify(library));
        if (library) {
          if (library.isPersonal) {
            const libUserId = String(library.userId || '');
            const libCreatedBy = String(library.createdBy || '');
            const hasAccess = libUserId === userId || libCreatedBy === userId;
            console.log(`[canAccessLibrary] Personal library access check: hasAccess=${hasAccess}`);
            return hasAccess;
          }
          // Shared library - if we got it, we have access (data-api checks RLS)
          console.log(`[canAccessLibrary] Shared library, granting access`);
          return true;
        }
      }
      
      if (response.status === 404) {
        console.log(`[canAccessLibrary] Library not found in data-api`);
        return false;
      }
      
      const errorText = await response.text();
      console.error(`[canAccessLibrary] Data-api error: ${response.status} - ${errorText}`);
      return false;
    } catch (error) {
      console.error('[canAccessLibrary] Error checking via data-api:', error);
      return false;
    }
  }
  
  console.log(`[canAccessLibrary] No sessionJwt provided, denying access`);
  return false;
}

/**
 * Check if user can upload to a library
 * - Personal library: must be the owner
 * - Shared library: must have access via authz bindings
 */
export async function canUploadToLibrary(
  userId: string,
  libraryId: string,
  sessionJwt?: string
): Promise<boolean> {
  return canAccessLibrary(userId, libraryId, sessionJwt);
}

/**
 * Get all libraries accessible to user
 * Fetches from data-api which is the source of truth for libraries.
 * 
 * @param userId - User ID  
 * @param sessionJwt - Session JWT for Zero Trust token exchange (REQUIRED)
 */
export async function getUserLibraries(
  userId: string,
  sessionJwt: string
): Promise<LibraryWithRole[]> {
  try {
    console.log(`[getUserLibraries] Getting libraries for user: ${userId}`);
    
    const accessToken = await exchangeForDataApiToken(userId, sessionJwt);
    
    const response = await fetch(`${getDataApiUrl()}/libraries?include_shared=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[getUserLibraries] Data-api error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to fetch libraries: ${response.status}`);
    }

    const data = await response.json();
    const libraries = data.data || [];
    console.log(`[getUserLibraries] Got ${libraries.length} libraries from data-api`);
    
    const authzOptions = {
      ...getAuthzOptions(),
      accessToken: sessionJwt,
    };
    
    const librariesWithRoles = await Promise.all(
      libraries.map(async (lib: any) => {
        let roles: LibraryRoleInfo[] = [];
        if (!lib.isPersonal) {
          try {
            const roleBindings = await getResourceRoles('library', lib.id, authzOptions);
            roles = roleBindings.map((rb: any) => ({
              id: rb.id,
              name: rb.name,
              description: rb.description || null,
            }));
          } catch (error) {
            console.error('[LIBRARIES] Error getting library roles:', error);
          }
        }
        
        return {
          ...toLibrary(lib),
          role: null,
          roles,
          _count: {
            documents: lib.documentCount || 0,
          },
        } as LibraryWithRole;
      })
    );

    return librariesWithRoles;
  } catch (error) {
    console.error('[LIBRARIES] Error getting user libraries:', error);
    return [];
  }
}

/**
 * Get documents in a library via data-api.
 */
export async function getLibraryDocuments(
  libraryId: string,
  options: {
    sortBy?: 'name' | 'createdAt' | 'size';
    sortOrder?: 'asc' | 'desc';
    status?: string;
    tag?: string;
    tags?: string[];
    search?: string;
    sessionJwt: string;
    userId: string;
  }
) {
  const { sortBy = 'createdAt', sortOrder = 'desc', status, tag, tags, search, sessionJwt, userId } = options;

  const params = new URLSearchParams();
  params.append('sortBy', sortBy);
  params.append('sortOrder', sortOrder);
  if (status) params.append('status', status);
  if (tag) params.append('tag', tag);
  if (tags && tags.length > 0) params.append('tags', tags.join(','));
  if (search) params.append('search', search);

  const accessToken = await exchangeForDataApiToken(userId, sessionJwt);
  
  const dataUrl = getDataApiUrl();
  const response = await fetch(`${dataUrl}/libraries/${libraryId}/documents?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[getLibraryDocuments] Data-api error: ${response.status} - ${errorText}`);
    throw new Error(`Failed to fetch documents: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.documents || [];
}

/**
 * Check if user can manage a library (admin or creator).
 * Uses data-api to check library ownership.
 */
export async function canManageLibrary(
  userId: string,
  libraryId: string,
  sessionJwt?: string
): Promise<boolean> {
  const isAdmin = await hasRole(userId, 'Admin', getAuthzOptions());
  if (isAdmin) return true;

  if (!sessionJwt) return false;

  try {
    const accessToken = await exchangeForDataApiToken(userId, sessionJwt);
    const response = await fetch(`${getDataApiUrl()}/libraries/${libraryId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    const library = data.data;
    if (!library) return false;

    const createdBy = String(library.createdBy || library.created_by || '');
    return createdBy === userId;
  } catch (error) {
    console.error('[canManageLibrary] Error:', error);
    return false;
  }
}

/**
 * Set document visibility and library association when uploaded to a library.
 * This is now handled by data-api during upload -- this function is a no-op
 * kept for backward compatibility.
 */
export async function setDocumentVisibilityFromLibrary(
  documentId: string,
  libraryId: string
): Promise<void> {
  // Data-api handles visibility assignment during upload
  console.log(`[setDocumentVisibilityFromLibrary] No-op: data-api handles visibility for doc=${documentId} lib=${libraryId}`);
}

/**
 * Get a user's personal library by type via data-api.
 * Returns null if not found (use ensurePersonalLibrary to create if needed).
 */
export async function getPersonalLibraryByType(
  userId: string,
  libraryType: PersonalLibraryType,
  sessionJwt?: string
): Promise<Library | null> {
  try {
    let headers: Record<string, string>;
    if (sessionJwt) {
      const accessToken = await exchangeForDataApiToken(userId, sessionJwt);
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` };
    } else {
      headers = { 'Content-Type': 'application/json', 'X-Internal-Service': 'busibox-portal', 'X-User-Id': userId };
    }

    const response = await fetch(`${getDataApiUrl()}/libraries`, { headers });
    if (!response.ok) return null;

    const data = await response.json();
    const libs = data.data || [];
    const match = libs.find((l: any) =>
      (l.libraryType || l.library_type) === libraryType &&
      (l.isPersonal ?? l.is_personal) &&
      !l.deletedAt
    );
    return match ? toLibrary(match) : null;
  } catch (error) {
    console.error('[getPersonalLibraryByType] Error:', error);
    return null;
  }
}

/**
 * Get a user's library by name (for backwards compatibility and folder-based lookups).
 * Supports special folder names:
 * - "personal" or "personal-docs" -> DOCS library
 * - "personal-research" or "research" -> RESEARCH library
 */
export async function getLibraryByFolder(
  userId: string,
  folderName: string,
  sessionJwt?: string
): Promise<Library | null> {
  const normalizedFolder = folderName.toLowerCase().trim();
  
  let libraryType: PersonalLibraryType | null = null;
  
  switch (normalizedFolder) {
    case 'personal':
    case 'personal-docs':
    case 'docs':
      libraryType = PersonalLibraryTypes.DOCS;
      break;
    case 'personal-research':
    case 'research':
      libraryType = PersonalLibraryTypes.RESEARCH;
      break;
    case 'personal-tasks':
    case 'tasks':
      libraryType = PersonalLibraryTypes.TASKS;
      break;
    default: {
      // Not a known personal library type -- try to find by name via data-api
      try {
        let headers: Record<string, string>;
        if (sessionJwt) {
          const accessToken = await exchangeForDataApiToken(userId, sessionJwt);
          headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` };
        } else {
          headers = { 'Content-Type': 'application/json', 'X-Internal-Service': 'busibox-portal', 'X-User-Id': userId };
        }
        const response = await fetch(`${getDataApiUrl()}/libraries?include_shared=true`, { headers });
        if (response.ok) {
          const data = await response.json();
          const libs = data.data || [];
          const match = libs.find((l: any) =>
            l.name.toLowerCase() === normalizedFolder && !l.deletedAt
          );
          return match ? toLibrary(match) : null;
        }
      } catch (error) {
        console.error('[getLibraryByFolder] Error searching by name:', error);
      }
      return null;
    }
  }
  
  return ensurePersonalLibrary(userId, libraryType, sessionJwt);
}
