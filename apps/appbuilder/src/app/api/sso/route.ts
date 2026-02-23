/**
 * SSO Route Handler
 * 
 * Handles SSO token exchange from Busibox Portal.
 * Uses shared handlers from @jazzmind/busibox-app for consistent behavior.
 * 
 * GET: Redirect-based flow (validates token from URL, redirects with cookies)
 * POST: API-based flow (validates token from body, returns JSON with cookies)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSSOGetHandler, createSSOPostHandler } from "@jazzmind/busibox-app/lib/authz";

// Create handlers with optional verbose logging for debugging
const verbose = process.env.VERBOSE_AUTH_LOGGING === 'true';

const handleGet = createSSOGetHandler(NextResponse, { 
  verbose,
  defaultAppName: 'busibox-appbuilder',
});

const handlePost = createSSOPostHandler(NextResponse, { 
  verbose,
  defaultAppName: 'busibox-appbuilder',
});

export async function GET(request: NextRequest) {
  return handleGet(request);
}

export async function POST(request: NextRequest) {
  return handlePost(request);
}
