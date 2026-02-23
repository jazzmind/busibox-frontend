import { getAuthorizationHeaderWithSession, getAuthzOptions } from '@jazzmind/busibox-app/lib/authz/next-client';
import {
  listRoles,
  createRole,
  getUserRoles as authzGetUserRoles,
  addUserRole,
  removeUserRole,
  getRoleByName,
} from '@jazzmind/busibox-app';

const TEST_ROLE_NAMES = ['test-role-a', 'test-role-b', 'test-role-c'];

type RoleRecord = { id: string; name: string };

/**
 * Ensure the standard test roles exist and return a map of name -> id.
 */
export async function ensureTestRoles(): Promise<Record<string, string>> {
  const options = getAuthzOptions();
  const allRoles = await listRoles(options);
  
  const map: Record<string, string> = {};
  
  for (const role of allRoles) {
    if (TEST_ROLE_NAMES.includes(role.name)) {
      map[role.name] = role.id;
    }
  }

  for (const roleName of TEST_ROLE_NAMES) {
    if (!map[roleName]) {
      const created = await createRole(
        roleName,
        'Test role for admin permission harness',
        options,
        [] // scopes
      );
      map[created.name] = created.id;
    }
  }

  return map;
}

/**
 * Get all roles (id + name) assigned to the user.
 */
export async function getUserRoles(userId: string): Promise<RoleRecord[]> {
  const options = getAuthzOptions();
  const roles = await authzGetUserRoles(userId, options);
  return roles.map((r) => ({ id: r.id, name: r.name }));
}

/**
 * Update the current user's test-role assignments.
 * - Keeps Admin and any non-test roles intact
 * - Removes unselected test roles
 * - Adds selected test roles
 */
export async function setUserTestRoles(
  userId: string,
  selectedRoleNames: string[]
): Promise<RoleRecord[]> {
  const options = getAuthzOptions();
  const testRoleMap = await ensureTestRoles();
  const selectedIds = selectedRoleNames
    .filter((name) => testRoleMap[name])
    .map((name) => testRoleMap[name]);

  // Get current user roles
  const currentRoles = await authzGetUserRoles(userId, options);
  const currentTestRoleIds = currentRoles
    .filter((r) => TEST_ROLE_NAMES.includes(r.name))
    .map((r) => r.id);

  // Remove test roles not selected
  for (const roleId of currentTestRoleIds) {
    if (!selectedIds.includes(roleId)) {
      await removeUserRole(userId, roleId, options);
    }
  }

  // Add selected roles that are missing
  for (const roleId of selectedIds) {
    if (!currentTestRoleIds.includes(roleId)) {
      await addUserRole(userId, roleId, options);
    }
  }

  // Return latest roles
  return getUserRoles(userId);
}

/**
 * Build a service JWT for downstream data/search calls (Zero Trust).
 *
 * @param sessionJwt - The user's session JWT
 * @param user - User info
 */
export async function buildServiceAuthorization(
  sessionJwt: string,
  user: {
    id: string;
    email: string;
  }
): Promise<string> {
  return getAuthorizationHeaderWithSession({
    sessionJwt,
    userId: user.id,
    audience: 'data-api',
    scopes: [],
    purpose: 'busibox-portal.admin-test',
  });
}

export function getTestRoleNames() {
  return TEST_ROLE_NAMES;
}
