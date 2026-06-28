import type { AuthAdapter, PlatformUser, TokenClaims } from '../../interfaces/auth';

interface VercelAuthConfig {
  /** Get session from Auth.js. If not provided, reads Bearer token from Authorization header. */
  getSession?: (request: Request) => Promise<{
    user?: { id?: string; email?: string | null; name?: string | null; role?: string } | null;
  } | null>;
}

export class VercelAuthAdapter implements AuthAdapter {
  private getSession?: VercelAuthConfig['getSession'];

  constructor(config: VercelAuthConfig = {}) {
    this.getSession = config.getSession;
  }

  async getCurrentUser(request: Request): Promise<PlatformUser | null> {
    if (this.getSession) {
      try {
        const session = await this.getSession(request);
        if (!session?.user?.email) return null;

        return {
          id: session.user.id ?? session.user.email,
          email: session.user.email,
          name: session.user.name ?? undefined,
          role: session.user.role ?? 'user',
        };
      } catch {
        return null;
      }
    }

    // Fallback: decode JWT from Authorization header (for API routes using next-auth JWT)
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return null;

    const token = auth.slice(7);
    return this.decodeJwt(token);
  }

  async validateToken(token: string): Promise<TokenClaims | null> {
    // Attempt to decode JWT payload (no verification — rely on session middleware for that)
    try {
      const [, payload] = token.split('.');
      if (!payload) return null;

      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as TokenClaims;
      if (!decoded.sub || !decoded.exp) return null;

      // Check expiry
      if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

      return decoded;
    } catch {
      return null;
    }
  }

  async requireAuth(request: Request): Promise<PlatformUser> {
    const user = await this.getCurrentUser(request);
    if (!user) throw new Error('Unauthorized');
    return user;
  }

  private decodeJwt(token: string): PlatformUser | null {
    try {
      const [, payload] = token.split('.');
      if (!payload) return null;

      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
        sub?: string;
        email?: string;
        name?: string;
        role?: string;
        exp?: number;
      };

      if (!decoded.sub || !decoded.email) return null;
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;

      return {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role ?? 'user',
      };
    } catch {
      return null;
    }
  }
}
