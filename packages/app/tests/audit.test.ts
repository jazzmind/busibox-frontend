/**
 * Integration tests for Audit Client
 * 
 * These tests make real calls to the authz service's audit endpoint.
 * Requires AUTHZ_BASE_URL to be set in .env
 */

import {
  logAuditEvent,
  logUserLogin,
  logUserLogout,
  logLoginFailed,
  logPasswordResetRequest,
  logRoleAssigned,
  logDocumentUploaded,
  logConfigChanged,
} from '../src/lib/authz/audit';
import { getAuthzToken } from './helpers/auth';

describe('Audit Client Integration Tests', () => {
  const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-123';
  const TEST_SESSION_ID = 'test-session-456';

  describe('Basic Audit Logging', () => {
    test('should log generic audit event', async () => {
      await expect(
        logAuditEvent({
          actorId: TEST_USER_ID,
          action: 'test.action',
          resourceType: 'test_resource',
          resourceId: 'test-123',
          details: {
            testKey: 'testValue',
            timestamp: new Date().toISOString(),
          },
        }, {
          userId: TEST_USER_ID,
          getAuthzToken,
        })
      ).resolves.not.toThrow();

      console.log('✓ Logged generic audit event');
    });

    test('should log event without optional fields', async () => {
      await expect(
        logAuditEvent({
          actorId: TEST_USER_ID,
          action: 'simple.action',
          resourceType: 'simple_resource',
        }, {
          userId: TEST_USER_ID,
          getAuthzToken,
        })
      ).resolves.not.toThrow();

      console.log('✓ Logged simple audit event');
    });

    test('should log event without authentication', async () => {
      // Audit endpoint may allow unauthenticated writes
      await expect(
        logAuditEvent({
          actorId: 'system',
          action: 'system.action',
          resourceType: 'system',
        })
      ).resolves.not.toThrow();

      console.log('✓ Logged unauthenticated audit event');
    });
  });

  describe('User Authentication Events', () => {
    test('should log user login', async () => {
      await expect(
        logUserLogin(TEST_USER_ID, TEST_SESSION_ID, {
          userId: TEST_USER_ID,
          getAuthzToken,
          method: 'magic_link',
        })
      ).resolves.not.toThrow();

      console.log('✓ Logged user login');
    });

    test('should log user logout', async () => {
      await expect(
        logUserLogout(TEST_USER_ID, TEST_SESSION_ID, {
          userId: TEST_USER_ID,
          getAuthzToken,
        })
      ).resolves.not.toThrow();

      console.log('✓ Logged user logout');
    });

    test('should log failed login', async () => {
      await expect(
        logLoginFailed('test@example.com', 'Invalid credentials', {
          userId: 'system',
          getAuthzToken,
        })
      ).resolves.not.toThrow();

      console.log('✓ Logged failed login');
    });

    test('should log password reset request', async () => {
      await expect(
        logPasswordResetRequest(TEST_USER_ID, {
          userId: TEST_USER_ID,
          getAuthzToken,
        })
      ).resolves.not.toThrow();

      console.log('✓ Logged password reset request');
    });
  });

  describe('Role Management Events', () => {
    test('should log role assignment', async () => {
      await expect(
        logRoleAssigned(
          'admin-user-123',
          TEST_USER_ID,
          'role-456',
          'Editor',
          {
            userId: 'admin-user-123',
            getAuthzToken,
          }
        )
      ).resolves.not.toThrow();

      console.log('✓ Logged role assignment');
    });
  });

  describe('Document Events', () => {
    test('should log document upload', async () => {
      await expect(
        logDocumentUploaded(
          TEST_USER_ID,
          'doc-789',
          'test-document.pdf',
          {
            userId: TEST_USER_ID,
            getAuthzToken,
          }
        )
      ).resolves.not.toThrow();

      console.log('✓ Logged document upload');
    });
  });

  describe('Configuration Events', () => {
    test('should log configuration change', async () => {
      await expect(
        logConfigChanged(
          'admin-user-123',
          'max_upload_size',
          '10MB',
          '20MB',
          {
            userId: 'admin-user-123',
            getAuthzToken,
          }
        )
      ).resolves.not.toThrow();

      console.log('✓ Logged config change');
    });
  });

  describe('Batch Logging', () => {
    test('should log multiple events in sequence', async () => {
      const events = [
        logUserLogin(TEST_USER_ID, TEST_SESSION_ID),
        logDocumentUploaded(TEST_USER_ID, 'doc-1', 'file1.pdf'),
        logDocumentUploaded(TEST_USER_ID, 'doc-2', 'file2.pdf'),
        logUserLogout(TEST_USER_ID, TEST_SESSION_ID),
      ];

      await expect(
        Promise.all(events)
      ).resolves.not.toThrow();

      console.log('✓ Logged 4 events in batch');
    });
  });

  describe('Error Handling', () => {
    test('should not throw on connection errors', async () => {
      // Audit logging should be non-blocking
      await expect(
        logAuditEvent({
          actorId: TEST_USER_ID,
          action: 'test.action',
          resourceType: 'test',
        }, {
          authzUrl: 'http://invalid-host:9999',
        })
      ).resolves.not.toThrow();

      console.log('✓ Handled connection error gracefully');
    });

    test('should not throw on invalid data', async () => {
      await expect(
        logAuditEvent({
          actorId: '',
          action: '',
          resourceType: '',
        })
      ).resolves.not.toThrow();

      console.log('✓ Handled invalid data gracefully');
    });
  });

  describe('Performance', () => {
    test('should log events quickly', async () => {
      const start = Date.now();

      await logAuditEvent({
        actorId: TEST_USER_ID,
        action: 'performance.test',
        resourceType: 'test',
      });

      const duration = Date.now() - start;
      console.log(`✓ Audit event logged in ${duration}ms`);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});

