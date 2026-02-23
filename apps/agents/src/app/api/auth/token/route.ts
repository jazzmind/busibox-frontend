/**
 * GET /api/auth/token
 * 
 * Returns the current user's agent-api auth token for use in client-side API calls.
 * This exchanges the SSO token for an authz token that agent-server accepts.
 * This is needed because httpOnly cookies can't be accessed from JavaScript.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';

export async function GET(request: NextRequest) {
  try {
    // Authenticate and exchange token
    const auth = await requireAuthWithTokenExchange(request);
    
    // Check if it's an error response
    if (auth instanceof NextResponse) {
      return auth; // Return the error response
    }

    // Return the agent-api token (authz token)
    return NextResponse.json({ token: auth.apiToken });
  } catch (error) {
    console.error('[Auth Token] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get token' },
      { status: 500 }
    );
  }
}
