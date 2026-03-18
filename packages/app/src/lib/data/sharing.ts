/**
 * Document Sharing Utilities for Busibox apps.
 *
 * Provides high-level helpers for managing team-based document sharing using
 * authz self-service roles and data-api document roles.
 *
 * Two token types are required:
 *  - **ssoToken**: The SSO session JWT (`busibox-session` cookie). Used for
 *    authz self-service endpoints (role CRUD, member management, user search).
 *  - **dataToken**: The app-scoped data-api token from
 *    `requireAuthWithTokenExchange(request, 'data-api')`. Used for data-api
 *    document/library role management.
 *
 * Visibility modes:
 *  - `private` (or `personal`)  → `visibility: 'personal'` — only the document owner
 *  - `shared`   → `visibility: 'authenticated'` — any app user
 *  - `team`     → `visibility: 'shared'` with role(s) — only users with the role
 *
 * @example
 * ```typescript
 * import {
 *   ensureTeamRole,
 *   addRoleToDocuments,
 *   addTeamMember,
 *   listTeamMembers,
 *   searchUsers,
 * } from '@jazzmind/busibox-app/lib/data/sharing';
 *
 * // App-level sharing (one team for the whole app)
 * const role = await ensureTeamRole(ssoToken, 'busibox-workforce', 'employees');
 * await addRoleToDocuments(dataToken, role.roleId, [docId1, docId2]);
 * await addTeamMember(ssoToken, role.roleId, userId);
 *
 * // Entity-level sharing (one team per campaign)
 * const role = await ensureTeamRole(ssoToken, 'busibox-recruiter', `campaign-${slug}`);
 * await addRoleToDocuments(dataToken, role.roleId, [campaignsDoc, activitiesDoc]);
 * await addRoleToLibrary(dataToken, role.roleId, libraryId);
 * ```
 */

import { getDocumentRoles, updateDocumentRoles } from './documents';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const getAuthzBaseUrl = () =>
  process.env.AUTHZ_BASE_URL || 'http://localhost:8010';

const getDataApiUrl = () =>
  process.env.DATA_API_URL || 'http://localhost:8002';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VisibilityMode = 'private' | 'personal' | 'shared' | 'team';

/**
 * Normalize a VisibilityMode so that `'personal'` is treated as `'private'`.
 * Data-api uses `'personal'` internally, but the user-facing mode is `'private'`.
 */
export function normalizeVisibilityMode(mode: VisibilityMode): 'private' | 'shared' | 'team' {
  return mode === 'personal' ? 'private' : mode;
}

export interface TeamMember {
  user_id: string;
  email: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  status?: string;
  assigned_at?: string;
}

export interface TeamRole {
  roleId: string;
  roleName: string;
  created: boolean;
}

export interface SearchUser {
  user_id: string;
  email: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

// ---------------------------------------------------------------------------
// Role Management (authz self-service endpoints, requires ssoToken)
// ---------------------------------------------------------------------------

/**
 * Create or find an existing self-service team role.
 *
 * Role names follow the pattern `app:{appName}:{entityName}-team`.
 * If a role with that name already exists (and belongs to the caller),
 * it is returned instead of creating a duplicate.
 *
 * The caller is automatically assigned to the role on creation.
 *
 * When `appResourceId` is provided, the role is also bound to the app
 * in authz so that it appears in app-scoped token exchanges. This is
 * required for team roles to be included in the JWT when users launch
 * the app from the portal.
 */
export async function ensureTeamRole(
  ssoToken: string,
  appName: string,
  entityName: string,
  options?: { description?: string; scopes?: string[]; appResourceId?: string },
): Promise<TeamRole> {
  const roleName = `app:${appName}:${entityName}-team`;
  const authzUrl = getAuthzBaseUrl();
  const headers = { Authorization: `Bearer ${ssoToken}` };

  let roleId: string;
  let roleNameResult: string;
  let created: boolean;

  // Try to create first — fast path when role doesn't exist
  const createRes = await fetch(`${authzUrl}/roles`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: roleName,
      description: options?.description ?? `Team role for ${appName} ${entityName}`,
      scopes: options?.scopes ?? ['data:read', 'data:write'],
    }),
  });

  if (createRes.ok) {
    const role = await createRes.json();
    roleId = role.id;
    roleNameResult = role.name;
    created = true;
  } else {
    // Creation failed (likely duplicate) — search for existing
    const listRes = await fetch(
      `${authzUrl}/roles?app=${encodeURIComponent(appName)}`,
      { headers },
    );
    if (!listRes.ok) {
      const text = await listRes.text().catch(() => '');
      throw new Error(`Failed to list roles for ${appName}: ${listRes.status} ${text}`);
    }

    const roles = (await listRes.json()) as Array<{ id: string; name: string }>;
    const existing = roles.find((r) => r.name === roleName);
    if (!existing) {
      const createText = await createRes.text().catch(() => '');
      throw new Error(`Failed to create or find role ${roleName}: ${createRes.status} ${createText}`);
    }

    roleId = existing.id;
    roleNameResult = existing.name;
    created = false;
  }

  // Ensure the role is bound to the app so it appears in app-scoped tokens
  if (options?.appResourceId) {
    try {
      await fetch(`${authzUrl}/roles/${roleId}/bindings`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: 'app',
          resource_id: options.appResourceId,
        }),
      });
    } catch (err) {
      console.warn(`[sharing] Failed to bind role ${roleId} to app ${options.appResourceId}:`, err);
    }
  }

  return { roleId, roleName: roleNameResult, created };
}

/**
 * Verify a role still exists in authz. Returns `true` if it does.
 */
export async function verifyRoleExists(
  ssoToken: string,
  roleId: string,
): Promise<boolean> {
  const res = await fetch(`${getAuthzBaseUrl()}/roles/${roleId}`, {
    headers: { Authorization: `Bearer ${ssoToken}` },
  });
  return res.ok;
}

/**
 * Ensure a role has an app binding in authz (idempotent, fire-and-forget).
 *
 * Call this whenever you have a cached role ID and an app resource ID to
 * self-heal existing team roles that were created before app bindings were
 * implemented. Safe to call frequently — the authz endpoint is idempotent
 * and returns 200 if the binding already exists.
 *
 * Errors are swallowed so this never blocks the calling code path.
 */
export function ensureRoleAppBinding(
  ssoToken: string,
  roleId: string,
  appResourceId: string,
): void {
  const authzUrl = getAuthzBaseUrl();
  fetch(`${authzUrl}/roles/${roleId}/bindings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ssoToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resource_type: 'app',
      resource_id: appResourceId,
    }),
  }).catch(() => {
    // Fire-and-forget: swallow errors
  });
}

// ---------------------------------------------------------------------------
// Document Role Management (data-api endpoints, requires dataToken)
// ---------------------------------------------------------------------------

/**
 * Add a role to one or more data documents (idempotent).
 *
 * Reads the current roles for each document and adds the role if missing.
 * Also sets `visibility: 'shared'` so RLS grants access via role membership.
 */
export async function addRoleToDocuments(
  dataToken: string,
  roleId: string,
  documentIds: string[],
): Promise<void> {
  await Promise.all(
    documentIds.map(async (docId) => {
      const current = await getDocumentRoles(dataToken, docId);
      const existingIds: string[] = current.roleIds ?? (current.roles ?? []).map((r) => r.role_id);

      if (existingIds.includes(roleId)) return;

      await updateDocumentRoles(
        dataToken,
        docId,
        [...existingIds, roleId],
        'shared',
      );
    }),
  );
}

/**
 * Remove a role from one or more data documents (idempotent).
 *
 * If the role is not present on a document, that document is skipped.
 */
export async function removeRoleFromDocuments(
  dataToken: string,
  roleId: string,
  documentIds: string[],
): Promise<void> {
  await Promise.all(
    documentIds.map(async (docId) => {
      const current = await getDocumentRoles(dataToken, docId);
      const existingIds: string[] = current.roleIds ?? (current.roles ?? []).map((r) => r.role_id);

      if (!existingIds.includes(roleId)) return;

      const newIds = existingIds.filter((id) => id !== roleId);
      await updateDocumentRoles(dataToken, docId, newIds, newIds.length > 0 ? 'shared' : 'personal');
    }),
  );
}

/**
 * Add a role to a data-api library (idempotent).
 *
 * Uses PUT /libraries/{libraryId} with roleIds.
 */
export async function addRoleToLibrary(
  dataToken: string,
  roleId: string,
  libraryId: string,
): Promise<void> {
  const dataUrl = getDataApiUrl();
  const bearer = dataToken.startsWith('Bearer ') ? dataToken : `Bearer ${dataToken}`;

  const getRes = await fetch(`${dataUrl}/libraries/${libraryId}`, {
    headers: { Authorization: bearer },
  });
  if (!getRes.ok) {
    console.warn(`[sharing] Failed to get library ${libraryId}: ${getRes.status}`);
    return;
  }

  const library = await getRes.json();
  const existingRoleIds: string[] = library.roleIds ?? [];

  if (existingRoleIds.includes(roleId)) return;

  const putRes = await fetch(`${dataUrl}/libraries/${libraryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: bearer },
    body: JSON.stringify({ roleIds: [...existingRoleIds, roleId] }),
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '');
    console.warn(`[sharing] Failed to update library ${libraryId} roles: ${putRes.status} ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Team Member Management (authz endpoints, requires ssoToken)
// ---------------------------------------------------------------------------

/**
 * List members of a team role.
 */
export async function listTeamMembers(
  ssoToken: string,
  roleId: string,
): Promise<TeamMember[]> {
  const res = await fetch(`${getAuthzBaseUrl()}/roles/${roleId}/members`, {
    headers: { Authorization: `Bearer ${ssoToken}` },
  });

  if (!res.ok) {
    console.warn(`[sharing] Failed to list members for role ${roleId}: ${res.status}`);
    return [];
  }

  const data = await res.json();
  return data.members ?? [];
}

/**
 * Add a user to a team role.
 */
export async function addTeamMember(
  ssoToken: string,
  roleId: string,
  userId: string,
): Promise<{ user_id: string; role_id: string; created_at: string }> {
  const res = await fetch(`${getAuthzBaseUrl()}/roles/${roleId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ssoToken}`,
    },
    body: JSON.stringify({ userId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to add member ${userId} to role ${roleId}: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Remove a user from a team role.
 */
export async function removeTeamMember(
  ssoToken: string,
  roleId: string,
  userId: string,
): Promise<void> {
  const res = await fetch(`${getAuthzBaseUrl()}/roles/${roleId}/members/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${ssoToken}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to remove member ${userId} from role ${roleId}: ${res.status} ${text}`);
  }
}

// ---------------------------------------------------------------------------
// User Search (authz endpoint, requires ssoToken)
// ---------------------------------------------------------------------------

/**
 * Search for users to add to a team.
 *
 * Minimum 2 characters required. Searches email, display name, first/last name.
 */
export async function searchUsers(
  ssoToken: string,
  query: string,
): Promise<SearchUser[]> {
  if (!query || query.length < 2) return [];

  const res = await fetch(
    `${getAuthzBaseUrl()}/roles/users/search?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${ssoToken}` } },
  );

  if (!res.ok) {
    console.warn(`[sharing] User search failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  return data.users ?? [];
}

// ---------------------------------------------------------------------------
// Visibility Mode Management
// ---------------------------------------------------------------------------

/**
 * Map a data-api visibility + role presence to a VisibilityMode.
 */
export function resolveVisibilityMode(
  visibility: string,
  roleIds: string[],
  teamRoleName?: string,
  roles?: Array<{ role_id: string; role_name?: string }>,
): VisibilityMode {
  if (visibility === 'personal') return 'private';
  if (visibility === 'authenticated') return 'shared';
  if (visibility === 'shared') {
    if (teamRoleName && roles) {
      return roles.some((r) => r.role_name === teamRoleName) ? 'team' : 'shared';
    }
    return roleIds.length > 0 ? 'team' : 'shared';
  }
  return 'private';
}

/**
 * Set documents to a specific visibility mode.
 *
 * - `private`: Sets `visibility: 'personal'`, removes all roles.
 * - `shared`: Sets `visibility: 'authenticated'`, keeps existing roles.
 * - `team`: Ensures team role exists, sets `visibility: 'shared'`, adds team role.
 *
 * For `team` mode, pass `callerRoleIds` (from `extractRoleIdsFromToken`) so the
 * caller's own roles are preserved alongside the team role.
 */
export async function setDocumentVisibility(
  dataToken: string,
  documentIds: string[],
  mode: VisibilityMode,
  roleId?: string,
  callerRoleIds?: string[],
): Promise<void> {
  const normalized = normalizeVisibilityMode(mode);
  switch (normalized) {
    case 'private':
      await Promise.all(
        documentIds.map((docId) =>
          updateDocumentRoles(dataToken, docId, [], 'personal'),
        ),
      );
      break;

    case 'shared':
      await Promise.all(
        documentIds.map(async (docId) => {
          const current = await getDocumentRoles(dataToken, docId);
          const existingIds = current.roleIds ?? [];
          // Keep existing roles but switch visibility
          await updateDocumentRoles(dataToken, docId, existingIds, 'shared');
        }),
      );
      break;

    case 'team': {
      if (!roleId) {
        throw new Error('roleId is required for team visibility mode');
      }
      const allRoleIds = [...new Set([...(callerRoleIds ?? []), roleId])];
      await Promise.all(
        documentIds.map((docId) =>
          updateDocumentRoles(dataToken, docId, allRoleIds, 'shared'),
        ),
      );
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// SSO Token Helper
// ---------------------------------------------------------------------------

/**
 * Extract the SSO session JWT from a Next.js request.
 *
 * The SSO token is always in the `busibox-session` cookie, regardless of the
 * app name. This is different from `getTokenFromRequest()` which returns the
 * app-scoped access token.
 */
export function getSSOTokenFromRequest(
  request: { cookies: { get: (name: string) => { value: string } | undefined } },
): string | null {
  return request.cookies.get('busibox-session')?.value ?? null;
}
