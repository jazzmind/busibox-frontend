import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@jazzmind/busibox-app/lib/authz/auth-helper';
import { getScopesFromToken } from '@jazzmind/busibox-app/lib/authz/auth-helper';

/**
 * GET /api/scopes
 * Returns OAuth scopes available to the current user (from their token).
 * Used when configuring agent scopes so users can only grant what they have.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    const scopes = token ? getScopesFromToken(token) : [];

    // If token has no scopes (e.g. session cookie without scope claim), return a default
    // set of known Busibox scopes so the UI remains usable; backend will enforce.
    const knownScopes =
      scopes.length > 0
        ? scopes
        : [
            'agent.execute',
            'search.read',
            'data.read',
            'data.write',
            'data.read',
            'data.write',
          ];

    return NextResponse.json({ scopes: knownScopes });
  } catch (error: unknown) {
    console.error('[API] Failed to get scopes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get scopes' },
      { status: 500 }
    );
  }
}
