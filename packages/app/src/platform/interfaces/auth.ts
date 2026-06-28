export interface PlatformUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  metadata?: Record<string, unknown>;
}

export interface TokenClaims {
  sub: string;
  aud?: string;
  exp: number;
  scopes?: string[];
  [key: string]: unknown;
}

export interface AuthAdapter {
  getCurrentUser(request: Request): Promise<PlatformUser | null>;
  getServiceToken?(audience: string): Promise<string>;
  validateToken?(token: string): Promise<TokenClaims | null>;
  requireAuth?(request: Request): Promise<PlatformUser>;
}
