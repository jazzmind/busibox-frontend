import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { AuthAdapter, PlatformUser, TokenClaims } from '../../interfaces/auth';

interface BusiboxAuthConfig {
  authzBaseUrl?: string;
  jwksUrl?: string;
  /** App audience for token exchange (e.g. 'agent-api') */
  audience?: string;
  /** Get the current session JWT (from server-side session) */
  getSessionToken: (request: Request) => Promise<string | null>;
}

export class BusiboxAuthAdapter implements AuthAdapter {
  private authzBaseUrl: string;
  private jwksUrl: string;
  private audience: string;
  private getSessionToken: (request: Request) => Promise<string | null>;
  private _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(config: BusiboxAuthConfig) {
    this.authzBaseUrl = config.authzBaseUrl ?? process.env.AUTHZ_BASE_URL ?? 'http://authz-api:8010';
    this.jwksUrl = config.jwksUrl ?? `${this.authzBaseUrl}/.well-known/jwks.json`;
    this.audience = config.audience ?? 'busibox';
    this.getSessionToken = config.getSessionToken;
  }

  async getCurrentUser(request: Request): Promise<PlatformUser | null> {
    try {
      const token = await this.getSessionToken(request);
      if (!token) return null;

      const claims = await this.verifyJwt(token);
      if (!claims) return null;

      return {
        id: claims.sub,
        email: (claims['email'] as string) ?? '',
        name: claims['name'] as string | undefined,
        role: claims['role'] as string | undefined,
        metadata: { scopes: claims.scopes },
      };
    } catch {
      return null;
    }
  }

  async getServiceToken(audience: string): Promise<string> {
    const response = await fetch(`${this.authzBaseUrl}/token/service`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get service token for "${audience}": ${response.status}`);
    }

    const data = await response.json() as { token: string };
    return data.token;
  }

  async validateToken(token: string): Promise<TokenClaims | null> {
    return this.verifyJwt(token);
  }

  async requireAuth(request: Request): Promise<PlatformUser> {
    const user = await this.getCurrentUser(request);
    if (!user) {
      throw new Error('Unauthorized');
    }
    return user;
  }

  private getJwks() {
    if (!this._jwks) {
      this._jwks = createRemoteJWKSet(new URL(this.jwksUrl));
    }
    return this._jwks;
  }

  private async verifyJwt(token: string): Promise<TokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.getJwks(), {
        audience: this.audience,
      });

      return {
        sub: payload.sub ?? '',
        aud: typeof payload.aud === 'string' ? payload.aud : undefined,
        exp: payload.exp ?? 0,
        scopes: payload['scopes'] as string[] | undefined,
        ...(payload as Record<string, unknown>),
      };
    } catch {
      return null;
    }
  }
}
