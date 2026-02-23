/**
 * Integration tests for RBAC Client
 * 
 * These tests make real calls to the authz service's admin endpoints.
 * Requires AUTHZ_BASE_URL and a test user that can mint authz-api admin-scoped tokens.
 */

import {
  listRoles,
  getRole,
  getRoleByName,
  getAllUsers,
  getUser,
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
} from '../src/lib/authz/rbac';
import { getAuthzToken } from './helpers/auth';

describe('RBAC Client Integration Tests', () => {
  const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-123';
  let adminToken = '';
  let testRoleId: string;

  beforeAll(async () => {
    adminToken = await getAuthzToken(TEST_USER_ID, 'authz-api', ['authz.roles.read', 'authz.roles.write', 'authz.users.read', 'authz.users.write']);
  });

  describe('Role Queries', () => {
    test('should list all roles', async () => {
      const roles = await listRoles({
        accessToken: adminToken,
      });

      expect(Array.isArray(roles)).toBe(true);
      console.log(`✓ Found ${roles.length} roles`);

      if (roles.length > 0) {
        expect(roles[0]).toHaveProperty('id');
        expect(roles[0]).toHaveProperty('name');
        console.log(`  Sample role: ${roles[0].name}`);
      }
    });

    test('should get role by name', async () => {
      const role = await getRoleByName('Admin', {
        accessToken: adminToken,
      });

      if (role) {
        expect(role).toHaveProperty('id');
        expect(role.name).toBe('Admin');
        console.log(`✓ Found Admin role: ${role.id}`);
      } else {
        console.log('⚠ Admin role not found (may not exist yet)');
      }
    });
  });

  describe('User Queries', () => {
    test('should list all users', async () => {
      const users = await getAllUsers({ accessToken: adminToken });

      expect(Array.isArray(users)).toBe(true);
      console.log(`✓ Found ${users.length} users`);

      if (users.length > 0) {
        expect(users[0]).toHaveProperty('id');
        expect(users[0]).toHaveProperty('email');
        console.log(`  Sample user: ${users[0].email}`);
      }
    });

    test('should get user by ID', async () => {
      const users = await getAllUsers({ accessToken: adminToken });
      
      if (users.length > 0) {
        const userId = users[0].id;
        const user = await getUser(userId, {
          accessToken: adminToken,
        });

        expect(user).toBeDefined();
        expect(user?.id).toBe(userId);
        expect(user?.roles).toBeDefined();
        console.log(`✓ Found user with ${user?.roles.length || 0} roles`);
      } else {
        console.log('⚠ No users to test with');
      }
    });

    test('should get user roles', async () => {
      const users = await getAllUsers({ accessToken: adminToken });
      
      if (users.length > 0) {
        const userId = users[0].id;
        const roles = await getUserRoles(userId, {
          accessToken: adminToken,
        });

        expect(Array.isArray(roles)).toBe(true);
        console.log(`✓ User has ${roles.length} roles`);

        if (roles.length > 0) {
          const roleNames = await getUserRoleNames(userId, {
            accessToken: adminToken,
          });
          console.log(`  Role names: ${roleNames.join(', ')}`);
        }
      } else {
        console.log('⚠ No users to test with');
      }
    });
  });

  describe('Permission Checks', () => {
    test('should check if user has specific role', async () => {
      const users = await getAllUsers({ accessToken: adminToken });
      
      if (users.length > 0) {
        const userId = users[0].id;
        const hasAdminRole = await hasRole(userId, 'Admin', {
          accessToken: adminToken,
        });

        expect(typeof hasAdminRole).toBe('boolean');
        console.log(`✓ User ${hasAdminRole ? 'has' : 'does not have'} Admin role`);
      } else {
        console.log('⚠ No users to test with');
      }
    });

    test('should check if user is admin', async () => {
      const users = await getAllUsers({ accessToken: adminToken });
      
      if (users.length > 0) {
        const userId = users[0].id;
        const admin = await isAdmin(userId, {
          accessToken: adminToken,
        });

        expect(typeof admin).toBe('boolean');
        console.log(`✓ User is ${admin ? 'an admin' : 'not an admin'}`);
      } else {
        console.log('⚠ No users to test with');
      }
    });

    test('should check if user has any of specified roles', async () => {
      const users = await getAllUsers({ accessToken: adminToken });
      
      if (users.length > 0) {
        const userId = users[0].id;
        const hasAny = await hasAnyRole(userId, ['Admin', 'Editor', 'Guest'], {
          accessToken: adminToken,
        });

        expect(typeof hasAny).toBe('boolean');
        console.log(`✓ User has ${hasAny ? 'at least one' : 'none'} of the specified roles`);
      } else {
        console.log('⚠ No users to test with');
      }
    });

    test('should check if user has all specified roles', async () => {
      const users = await getAllUsers({ accessToken: adminToken });
      
      if (users.length > 0) {
        const userId = users[0].id;
        const hasAll = await hasAllRoles(userId, ['Admin', 'Editor'], {
          accessToken: adminToken,
        });

        expect(typeof hasAll).toBe('boolean');
        console.log(`✓ User has ${hasAll ? 'all' : 'not all'} specified roles`);
      } else {
        console.log('⚠ No users to test with');
      }
    });
  });

  describe('Role Management (Admin Operations)', () => {
    test('should create a new role', async () => {
      const roleName = `TestRole_${Date.now()}`;
      
      const role = await createRole(
        roleName,
        'Test role for integration testing',
        { accessToken: adminToken }
      );

      expect(role).toBeDefined();
      expect(role.name).toBe(roleName);
      expect(role.id).toBeDefined();

      testRoleId = role.id;
      console.log(`✓ Created test role: ${roleName} (${testRoleId})`);
    });

    test('should get created role', async () => {
      if (!testRoleId) {
        console.log('⚠ Skipping - no test role created');
        return;
      }

      const role = await getRole(testRoleId, {
        accessToken: adminToken,
      });

      expect(role).toBeDefined();
      expect(role?.id).toBe(testRoleId);
      console.log(`✓ Retrieved test role: ${role?.name}`);
    });

    test('should update role', async () => {
      if (!testRoleId) {
        console.log('⚠ Skipping - no test role created');
        return;
      }

      const updatedRole = await updateRole(
        testRoleId,
        { description: 'Updated description for testing' },
        { accessToken: adminToken }
      );

      expect(updatedRole).toBeDefined();
      expect(updatedRole.description).toBe('Updated description for testing');
      console.log(`✓ Updated test role description`);
    });

    test('should add role to user', async () => {
      if (!testRoleId) {
        console.log('⚠ Skipping - no test role created');
        return;
      }

      const users = await getAllUsers({ accessToken: adminToken });
      if (users.length === 0) {
        console.log('⚠ Skipping - no users to test with');
        return;
      }

      const userId = users[0].id;

      await expect(
        addUserRole(userId, testRoleId, { accessToken: adminToken })
      ).resolves.not.toThrow();

      console.log(`✓ Added test role to user ${userId}`);

      // Verify role was added
      const hasTestRole = await hasRole(userId, (await getRole(testRoleId, { accessToken: adminToken }))!.name, {
        accessToken: adminToken,
      });
      console.log(`  User ${hasTestRole ? 'now has' : 'does not have'} the test role`);
    });

    test('should remove role from user', async () => {
      if (!testRoleId) {
        console.log('⚠ Skipping - no test role created');
        return;
      }

      const users = await getAllUsers({ accessToken: adminToken });
      if (users.length === 0) {
        console.log('⚠ Skipping - no users to test with');
        return;
      }

      const userId = users[0].id;

      await expect(
        removeUserRole(userId, testRoleId, { accessToken: adminToken })
      ).resolves.not.toThrow();

      console.log(`✓ Removed test role from user ${userId}`);
    });

    test('should delete test role', async () => {
      if (!testRoleId) {
        console.log('⚠ Skipping - no test role created');
        return;
      }

      await expect(
        deleteRole(testRoleId, { accessToken: adminToken })
      ).resolves.not.toThrow();

      console.log(`✓ Deleted test role ${testRoleId}`);

      // Verify role was deleted
      const role = await getRole(testRoleId, { accessToken: adminToken });
      expect(role).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid role ID', async () => {
      const role = await getRole('invalid-role-id', {
        accessToken: adminToken,
      });

      expect(role).toBeNull();
      console.log('✓ Handled invalid role ID gracefully');
    });

    test('should handle invalid user ID', async () => {
      const user = await getUser('invalid-user-id', {
        accessToken: adminToken,
      });

      expect(user).toBeNull();
      console.log('✓ Handled invalid user ID gracefully');
    });

    test('should handle connection errors', async () => {
      const roles = await listRoles({
        authzUrl: 'http://invalid-host:9999',
        accessToken: adminToken,
      });

      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBe(0);
      console.log('✓ Handled connection error gracefully');
    });

    test('should handle unauthorized access', async () => {
      await expect(
        createRole('UnauthorizedRole', 'Test', { accessToken: 'invalid-token' })
      ).rejects.toThrow();

      console.log('✓ Rejected unauthorized access');
    });
  });
});

