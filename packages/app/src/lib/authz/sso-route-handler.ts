/**
 * Shared SSO Route Handler
 * 
 * Provides reusable handlers for SSO token exchange in Busibox apps.
 * Use these handlers in your app's /api/sso/route.ts to avoid code duplication.
 * 
 * @example
 * ```typescript
 * // app/api/sso/route.ts
 * import { handleSSOGet, handleSSOPost } from '@jazzmind/busibox-app/lib/authz';
 * 
 * export const GET = handleSSOGet;
 * export const POST = handleSSOPost;
 * ```
 */

import { validateSSOToken, createSessionFromSSO } from './sso';
import { sanitizeAppName } from './auth-helper';

/**
 * Request interface compatible with Next.js NextRequest
 */
interface NextRequestLike {
  json(): Promise<{ token?: string }>;
  nextUrl: {
    searchParams: {
      get(name: string): string | null;
    };
  };
  headers: {
    get(name: string): string | null;
  };
  url: string;
}

/**
 * Response instance interface - what a response object looks like
 */
interface ResponseInstance {
  cookies: {
    set(name: string, value: string, options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
      maxAge?: number;
      path?: string;
    }): void;
  };
}

/**
 * NextResponse class interface for static methods
 */
interface NextResponseClass {
  json(body: unknown, init?: { status?: number }): ResponseInstance;
  redirect(url: URL): ResponseInstance;
}

/**
 * Options for SSO handlers
 */
export interface SSOHandlerOptions {
  /** Override app name (default: process.env.APP_NAME or 'app') */
  appName?: string;
  /** Override base path (default: process.env.NEXT_PUBLIC_BASE_PATH or '/') */
  basePath?: string;
  /** Default fallback app name if APP_NAME not set */
  defaultAppName?: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /**
   * Override auth token cookie maxAge in seconds.
   * Default: 21600 (6 hours).
   * Also reads SSO_COOKIE_MAX_AGE env var.
   * Useful for testing token refresh with shorter expiry.
   */
  authTokenMaxAge?: number;
}

/**
 * Result of SSO POST handler
 */
export interface SSOPostResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    roles: string[];
    displayName?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    favoriteColor?: string;
  };
  error?: string;
  details?: string;
}

/**
 * Cookie configuration for SSO
 */
interface CookieConfig {
  sessionCookieName: string;
  authCookieName: string;
  basePath: string;
  isProduction: boolean;
  authTokenMaxAge: number;
}

/**
 * Get cookie configuration for SSO
 */
function getCookieConfig(options?: SSOHandlerOptions): CookieConfig {
  const rawAppName = options?.appName || process.env.APP_NAME || options?.defaultAppName || 'app';
  const appName = sanitizeAppName(rawAppName);
  const basePath = options?.basePath || process.env.NEXT_PUBLIC_BASE_PATH || '/';
  
  // Auth token cookie maxAge: option > env var > default 6 hours
  const envMaxAge = process.env.SSO_COOKIE_MAX_AGE ? parseInt(process.env.SSO_COOKIE_MAX_AGE, 10) : null;
  const authTokenMaxAge = options?.authTokenMaxAge || envMaxAge || 60 * 60 * 6;
  
  return {
    sessionCookieName: `${appName}-session`,
    authCookieName: `${appName}-auth-token`,
    basePath,
    isProduction: process.env.NODE_ENV === 'production',
    authTokenMaxAge,
  };
}

/**
 * Handle SSO GET request (redirect-based flow)
 * 
 * This handler validates the token from URL query params and redirects
 * back to the app with session cookies set.
 * 
 * @param request - Next.js NextRequest
 * @param NextResponse - Next.js NextResponse class
 * @param options - Optional configuration
 * @returns NextResponse redirect with cookies set
 */
export function createSSOGetHandler<T extends ResponseInstance>(
  NextResponse: { redirect(url: URL): T },
  options?: SSOHandlerOptions
): (request: NextRequestLike) => Promise<T> {
  return async function handleSSOGet(request: NextRequestLike): Promise<T> {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const returnUrl = searchParams.get('return') || '/';
    
    const verbose = options?.verbose ?? false;

    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    const redirectBase = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : (process.env.NEXT_PUBLIC_APP_URL
        || process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL
        || request.url);

    if (!token) {
      console.error('[SSO] No token provided');
      return NextResponse.redirect(new URL('/login?error=no_token', redirectBase));
    }

    try {
      // Get app name for both validation and cookies
      const rawAppName = options?.appName || process.env.APP_NAME || options?.defaultAppName || 'app';
      const config = getCookieConfig(options);
      
      // Validate token with the expected audience (app name)
      const validation = await validateSSOToken(token, { appName: rawAppName });

      if (!validation.valid) {
        console.error('[SSO] Token validation failed:', validation.error);
        return NextResponse.redirect(
          new URL(`/login?error=${validation.error}`, redirectBase)
        );
      }

      const session = createSessionFromSSO(validation);

      // Build redirect URL - avoid double basePath
      let redirectUrl: string;
      if (!returnUrl.startsWith('/')) {
        // Absolute URL, use as-is
        redirectUrl = returnUrl;
      } else if (config.basePath && config.basePath !== '/' && returnUrl.startsWith(config.basePath)) {
        // returnUrl already includes basePath, use as-is
        redirectUrl = returnUrl;
      } else {
        // Prepend basePath to relative URL
        redirectUrl = `${config.basePath}${returnUrl}`;
      }

      const response = NextResponse.redirect(new URL(redirectUrl, redirectBase));

      if (verbose) {
        console.log(`[SSO] GET: Setting cookies for app, path: ${config.basePath}`);
        console.log(`[SSO]   - ${config.sessionCookieName}`);
        console.log(`[SSO]   - ${config.authCookieName}`);
        console.log(`[SSO]   authTokenMaxAge: ${config.authTokenMaxAge}s`);
      }

      // Set session cookie
      response.cookies.set(config.sessionCookieName, JSON.stringify(session), {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: config.basePath || '/',
      });

      // Set auth token cookie (maxAge is configurable for testing)
      response.cookies.set(config.authCookieName, token, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        maxAge: config.authTokenMaxAge,
        path: config.basePath || '/',
      });

      return response;
    } catch (error) {
      console.error('[SSO] GET Error:', error);
      return NextResponse.redirect(
        new URL('/login?error=sso_failed', redirectBase)
      );
    }
  };
}

/**
 * Handle SSO POST request (API-based flow)
 * 
 * This handler validates the token from the request body and returns
 * a JSON response with session cookies set. This is the preferred method
 * as browsers properly process Set-Cookie headers from JSON responses.
 * 
 * @param request - Next.js NextRequest
 * @param NextResponse - Next.js NextResponse class
 * @param options - Optional configuration
 * @returns NextResponse with JSON body and cookies set
 */
export function createSSOPostHandler<T extends ResponseInstance>(
  NextResponse: { json(body: unknown, init?: { status?: number }): T },
  options?: SSOHandlerOptions
): (request: NextRequestLike) => Promise<T> {
  return async function handleSSOPost(request: NextRequestLike): Promise<T> {
    const verbose = options?.verbose ?? false;
    
    try {
      const body = await request.json();
      const token = body.token;

      if (!token) {
        return NextResponse.json(
          { success: false, error: 'No token provided' },
          { status: 400 }
        );
      }

      // Get app name for both validation and cookies
      const rawAppName = options?.appName || process.env.APP_NAME || options?.defaultAppName || 'app';
      const config = getCookieConfig(options);

      if (verbose) {
        console.log(`[SSO] POST received token for app: ${rawAppName} (sanitized cookie prefix)`);
        console.log(`[SSO] basePath for cookies: ${config.basePath}`);
      }

      // Validate token with the expected audience (app name)
      const validation = await validateSSOToken(token, { appName: rawAppName });

      if (!validation.valid) {
        if (verbose) {
          console.log(`[SSO] Token validation failed: ${validation.error}`);
        }
        return NextResponse.json(
          { success: false, error: 'Invalid token', details: validation.error },
          { status: 401 }
        );
      }

      if (verbose) {
        console.log(`[SSO] Token validated successfully for user: ${validation.userId}`);
      }

      const session = createSessionFromSSO(validation);

      const response = NextResponse.json({
        success: true,
        user: {
          id: session.userId,
          email: session.email,
          roles: session.roles,
          displayName: session.displayName,
          firstName: session.firstName,
          lastName: session.lastName,
          avatarUrl: session.avatarUrl,
          favoriteColor: session.favoriteColor,
        },
      } as SSOPostResult);

      if (verbose) {
        console.log(`[SSO] Setting cookies with path: ${config.basePath}`);
        console.log(`[SSO]   - ${config.sessionCookieName}`);
        console.log(`[SSO]   - ${config.authCookieName}`);
        console.log(`[SSO]   authTokenMaxAge: ${config.authTokenMaxAge}s`);
      }

      // Set session cookie
      response.cookies.set(config.sessionCookieName, JSON.stringify(session), {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: config.basePath,
      });

      // Set auth token cookie (maxAge is configurable for testing)
      response.cookies.set(config.authCookieName, token, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        maxAge: config.authTokenMaxAge,
        path: config.basePath,
      });

      if (verbose) {
        console.log('[SSO] Response cookies set, returning success');
      }

      return response;
    } catch (error) {
      console.error('[SSO] POST Error:', error);
      return NextResponse.json(
        { success: false, error: 'SSO failed' },
        { status: 500 }
      );
    }
  };
}
