import type { AuthAdapter, PlatformUser, TokenClaims } from '../../../../src/platform/interfaces/auth';

const FIXED_USER: PlatformUser = {
  id: 'memory-user-1',
  email: 'test@memory.test',
  name: 'Memory User',
  role: 'user',
};

const ADMIN_USER: PlatformUser = {
  id: 'memory-admin-1',
  email: 'admin@memory.test',
  name: 'Memory Admin',
  role: 'admin',
};

export class MemoryAuthAdapter implements AuthAdapter {
  private _user: PlatformUser | null = FIXED_USER;

  setUser(user: PlatformUser | null): void {
    this._user = user;
  }

  setAdmin(): void {
    this._user = ADMIN_USER;
  }

  setUnauthenticated(): void {
    this._user = null;
  }

  async getCurrentUser(_request: Request): Promise<PlatformUser | null> {
    return this._user;
  }

  async getServiceToken(audience: string): Promise<string> {
    return `memory-token-for-${audience}`;
  }

  async validateToken(token: string): Promise<TokenClaims | null> {
    if (!token.startsWith('memory-token-for-')) return null;
    return {
      sub: this._user?.id ?? 'unknown',
      aud: token.replace('memory-token-for-', ''),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  async requireAuth(_request: Request): Promise<PlatformUser> {
    if (!this._user) throw new Error('Unauthorized');
    return this._user;
  }
}
