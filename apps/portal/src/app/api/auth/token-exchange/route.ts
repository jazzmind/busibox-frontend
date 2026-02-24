/**
 * Downstream token endpoint (BFF).
 *
 * First-party apps call this endpoint (cookie-authenticated) to obtain an
 * authz-issued access token for a specific downstream audience.
 *
 * Uses Zero Trust token exchange - no client credentials required.
 * The session JWT cryptographically proves user identity.
 *
 * POST /api/auth/token-exchange
 * Body:
 * - audience: string (e.g. 'search-api', 'data-api', 'agent-api')
 * - scopes?: string[] (OAuth2 scopes)
 * - purpose?: string (audit/debug label)
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess, parseJsonBody, requireAuth, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;

  const sessionJwt = getSessionJwt(request);
  console.log('[AUTH/token-exchange] User from requireAuth:', JSON.stringify({
    id: user.id,
    email: user.email,
    hasSessionJwt: !!sessionJwt,
  }));

  if (!sessionJwt) {
    return apiError('Missing session JWT', 401);
  }

  const body = await parseJsonBody(request);
  if (!body) return apiError('Invalid JSON body', 400);

  const audience = body.audience as string | undefined;
  const scopes = (body.scopes as string[] | undefined) ?? [];
  const purpose = (body.purpose as string | undefined) ?? 'app';

  console.log('[AUTH/token-exchange] Request:', { audience, scopes, purpose, userId: user.id });

  if (!audience || typeof audience !== 'string') {
    return apiError('Missing required field: audience', 400);
  }

  try {
    const token = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience,
      scopes,
      purpose,
    });

    return apiSuccess({
      access_token: token.accessToken,
      token_type: token.tokenType,
      expires_in: token.expiresIn,
      scope: token.scope,
      audience,
    });
  } catch (err: any) {
    console.error('[AUTH/token-exchange] Token exchange failed:', err);
    return apiError(err?.message || 'Token exchange failed', 500);
  }
}
