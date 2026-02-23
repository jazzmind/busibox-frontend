/**
 * Next.js Proxy (formerly Middleware)
 * 
 * Lightweight request filter. The proxy does NOT enforce setup flow —
 * setup is only reachable via a magic link URL issued by `make install`.
 * 
 * Handles:
 * - Allows public routes, API calls, and static assets through
 * - All other routing/auth is handled by page-level guards
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that bypass all proxy checks
const PUBLIC_ROUTES = [
  '/login',
  '/verify',
  '/setup',
  '/about',
  '/maintenance',
];

// Path prefixes that bypass proxy entirely
const BYPASS_PREFIXES = [
  '/api/',
  '/_next/',
  '/favicon',
  '/portal/api/',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow API routes through without any checks
  if (BYPASS_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Allow public routes through
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next();
  }

  // All other routes — let the app handle auth/routing
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
