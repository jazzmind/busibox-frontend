import { NextRequest, NextResponse } from "next/server";

/**
 * Logout endpoint
 *
 * Clears app-specific session cookies only.
 * 
 * IMPORTANT: Does NOT clear busibox-session, which is the domain-wide
 * session cookie managed by Busibox Portal. Clearing that would log the
 * user out of ALL apps, not just this one.
 */
export async function POST(request: NextRequest) {
  const appName = process.env.APP_NAME || "app";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/";

  const response = NextResponse.json({ success: true });

  // Clear app-specific session cookie
  response.cookies.set(`${appName}-session`, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: basePath,
  });

  // NOTE: Do NOT clear busibox-session - that's the portal's domain-wide
  // session cookie. Clearing it would log the user out of ALL apps.

  // Clear app-specific auth_token cookie
  response.cookies.set("auth_token", "", {
    maxAge: 0,
    path: basePath,
  });

  return response;
}
