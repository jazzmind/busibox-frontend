import { describe, it, expect, beforeEach } from 'vitest';
import type { AuthAdapter } from '../../../src/platform/interfaces/auth';
import { MemoryAuthAdapter } from '../adapters/memory/auth';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/test', { headers });
}

export function runAuthContractTests(getAdapter: () => AuthAdapter): void {
  let adapter: AuthAdapter;

  beforeEach(() => {
    adapter = getAdapter();
  });

  describe('getCurrentUser', () => {
    it('returns a user object with required fields', async () => {
      const user = await adapter.getCurrentUser(makeRequest());
      if (user !== null) {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(typeof user.id).toBe('string');
        expect(typeof user.email).toBe('string');
      }
    });

    it('returns null or a user (not undefined)', async () => {
      const user = await adapter.getCurrentUser(makeRequest());
      expect(user === null || typeof user === 'object').toBe(true);
    });
  });

  describe('getServiceToken (optional)', () => {
    it('returns a string token if supported', async () => {
      if (!adapter.getServiceToken) return;
      const token = await adapter.getServiceToken('agent-api');
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('returns different tokens for different audiences', async () => {
      if (!adapter.getServiceToken) return;
      const t1 = await adapter.getServiceToken('agent-api');
      const t2 = await adapter.getServiceToken('data-api');
      expect(t1).not.toBe(t2);
    });
  });

  describe('validateToken (optional)', () => {
    it('returns claims for a valid token', async () => {
      if (!adapter.getServiceToken || !adapter.validateToken) return;
      const token = await adapter.getServiceToken('test-audience');
      const claims = await adapter.validateToken(token);
      if (claims !== null) {
        expect(claims).toHaveProperty('sub');
        expect(claims).toHaveProperty('exp');
        expect(typeof claims.sub).toBe('string');
        expect(typeof claims.exp).toBe('number');
      }
    });

    it('returns null for an invalid token', async () => {
      if (!adapter.validateToken) return;
      const result = await adapter.validateToken('invalid.token.string');
      expect(result).toBeNull();
    });
  });

  describe('requireAuth (optional)', () => {
    it('returns the user when authenticated', async () => {
      if (!adapter.requireAuth) return;
      const user = await adapter.requireAuth(makeRequest());
      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      expect(user).toHaveProperty('id');
    });
  });
}

// Run against MemoryAuthAdapter (authenticated state)
describe('MemoryAuthAdapter — auth contract (authenticated)', () => {
  const adapter = new MemoryAuthAdapter();

  runAuthContractTests(() => adapter);
});

// Additional tests for unauthenticated state
describe('MemoryAuthAdapter — unauthenticated state', () => {
  it('getCurrentUser returns null when unauthenticated', async () => {
    const adapter = new MemoryAuthAdapter();
    adapter.setUnauthenticated();
    const user = await adapter.getCurrentUser(new Request('http://localhost/test'));
    expect(user).toBeNull();
  });

  it('requireAuth throws when unauthenticated', async () => {
    const adapter = new MemoryAuthAdapter();
    adapter.setUnauthenticated();
    await expect(
      adapter.requireAuth!(new Request('http://localhost/test')),
    ).rejects.toThrow('Unauthorized');
  });
});
