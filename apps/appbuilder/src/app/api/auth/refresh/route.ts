import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, isTokenExpired, shouldRefreshToken } from "@jazzmind/busibox-app/lib/authz";
import { getApiToken, type AuthzAudience } from "@jazzmind/busibox-app/lib/authz/next-client";

/**
 * Token refresh endpoint
 *
 * Refreshes the access token if it's expired or about to expire.
 */
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: "No session token found", requiresReauth: true },
        { status: 401 }
      );
    }

    // Check if token is already expired
    if (isTokenExpired(token)) {
      return NextResponse.json(
        { error: "Session expired", requiresReauth: true },
        { status: 401 }
      );
    }

    // Get target audience from request body
    const body = await request.json().catch(() => ({}));
    const audience = (body.audience || "backend-api") as AuthzAudience;
    const scopes = body.scopes as string[] | undefined;

    // Exchange for new token
    const accessToken = await getApiToken(token, audience, scopes);

    return NextResponse.json({
      token: accessToken,
      expiresIn: 900,
    });
  } catch (error) {
    console.error("[Auth/Refresh] Error:", error);

    const message = error instanceof Error ? error.message : "Token refresh failed";

    return NextResponse.json(
      { error: "Token refresh failed", message, requiresReauth: true },
      { status: 401 }
    );
  }
}
