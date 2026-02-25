/**
 * Authentication Context
 * 
 * Provides authentication state management including:
 * - Token exchange status tracking from URL parameters
 * - Ready signal for data fetching
 * - Proactive token refresh via auth state manager
 * - Automatic redirect to portal when re-authentication is required
 * 
 * All auth operations (session check, token exchange, token refresh) are
 * handled by a single /api/auth/session endpoint:
 *   GET  — Return current session from app-scoped cookie
 *   POST {token} — SSO token exchange (set app-scoped cookies)
 *   POST {} — Token refresh (exchange SSO token for fresh API token)
 * 
 * This is the standard authentication context for Busibox apps that use
 * SSO tokens from Busibox Portal.
 * 
 * @example
 * ```tsx
 * import { AuthProvider, useAuth } from '@jazzmind/busibox-app';
 * 
 * // In your app layout
 * <AuthProvider 
 *   appId="my-app"
 *   portalUrl={process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL}
 *   basePath={process.env.NEXT_PUBLIC_BASE_PATH}
 * >
 *   {children}
 * </AuthProvider>
 * 
 * // In your components
 * function MyComponent() {
 *   const { isReady, isAuthenticated, authState } = useAuth();
 *   
 *   if (!isReady) return <Loading />;
 *   if (!isAuthenticated) return <NotAuthenticated />;
 *   
 *   return <AuthenticatedContent />;
 * }
 * ```
 */

'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import {
  createAuthStateManager,
  setGlobalAuthManager,
  clearGlobalAuthManager,
  type AuthStateManager,
  type AuthState,
} from '../lib/authz/auth-state-manager';

// ============================================================================
// Types
// ============================================================================

export interface AuthContextValue {
  /** Whether auth is ready (no pending token exchange) */
  isReady: boolean;
  /** Whether a token exchange is in progress */
  isExchanging: boolean;
  /** Trigger a data refresh (call this after token exchange) - increments on each auth change */
  refreshKey: number;
  /** Current auth state from the auth manager */
  authState: AuthState | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Force a token refresh */
  refreshToken: () => Promise<boolean>;
  /** Redirect to portal for re-authentication */
  redirectToPortal: (reason?: string) => void;
  /** Perform a system-wide logout */
  logout: () => Promise<void>;
}

export interface AuthProviderProps {
  children: React.ReactNode;
  /** App identifier - used for cookie naming and auth manager config */
  appId?: string;
  /** Busibox Portal URL for redirects (e.g., "https://portal.example.com") */
  portalUrl?: string;
  /** Base path for the app (e.g., "/myapp") - used for URL cleanup */
  basePath?: string;
  /** Session endpoint - GET returns session, POST handles exchange/refresh (default: "/api/auth/session") */
  sessionEndpoint?: string;
  /** Token refresh endpoint - POST with empty body (default: "/api/auth/session") */
  refreshEndpoint?: string;
  /** Token exchange endpoint - POST with {token} (default: "/api/auth/session") */
  exchangeEndpoint?: string;
  /** Logout endpoint (default: "/api/logout") */
  logoutEndpoint?: string;
  /** Check interval in ms (default: 30000) */
  checkIntervalMs?: number;
  /** Buffer before expiry to trigger refresh in ms (default: 300000 = 5 min) */
  refreshBufferMs?: number;
  /** Whether to auto-redirect to portal on auth failure (default: true if portalUrl provided) */
  autoRedirect?: boolean;
  /**
   * Override the portal's silent SSO refresh URL.
   * Default: auto-derived from portalUrl (e.g., "https://localhost/portal/api/auth/token")
   */
  silentRefreshUrl?: string;
  /**
   * Testing only: Override token lifetime in ms. The auth manager will pretend
   * the token expires this many ms after it was first seen, regardless of the
   * actual JWT exp claim. Do NOT use in production.
   */
  tokenExpiresOverrideMs?: number;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue>({
  isReady: true,
  isExchanging: false,
  refreshKey: 0,
  authState: null,
  isAuthenticated: false,
  refreshToken: async () => false,
  redirectToPortal: () => {},
  logout: async () => {},
});

/**
 * Hook to access authentication state and methods
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ============================================================================
// Provider
// ============================================================================

/**
 * Authentication Provider
 * 
 * Handles:
 * 1. Token exchange from URL ?token= parameter (from Busibox Portal SSO)
 * 2. Auth state monitoring and proactive refresh
 * 3. Automatic redirect to portal when session expires
 */
export function AuthProvider({
  children,
  appId,
  portalUrl: portalUrlProp,
  basePath: basePathProp,
  sessionEndpoint = '/api/auth/session',
  refreshEndpoint = '/api/auth/session',
  exchangeEndpoint = '/api/auth/session',
  logoutEndpoint = '/api/logout',
  checkIntervalMs = 30_000,
  refreshBufferMs = 5 * 60 * 1000,
  autoRedirect,
  silentRefreshUrl,
  tokenExpiresOverrideMs,
}: AuthProviderProps) {
  const [isExchanging, setIsExchanging] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [tokenExchangeComplete, setTokenExchangeComplete] = useState(false);
  
  const authManagerRef = useRef<AuthStateManager | null>(null);
  
  // Get configuration from props or environment
  const portalUrl = portalUrlProp || (typeof process !== 'undefined' ? (process.env?.NEXT_PUBLIC_BUSIBOX_PORTAL_URL || process.env?.NEXT_PUBLIC_AI_PORTAL_URL) : '') || '';
  const basePath = basePathProp || (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_BASE_PATH : '') || '';
  const resolvedAppId = appId || (typeof process !== 'undefined' ? process.env?.APP_NAME : '') || 'busibox-app';
  const shouldAutoRedirect = autoRedirect ?? Boolean(portalUrl);

  // Handle token exchange from URL FIRST, before starting auth manager
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') {
      setTokenExchangeComplete(true);
      setIsReady(true);
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');
    
    if (!token) {
      setTokenExchangeComplete(true);
      setIsReady(true);
      return;
    }

    // If token is already expired, redirect to portal so it can auto-relaunch with a fresh token
    if (isTokenExpired(token) && portalUrl && resolvedAppId) {
      const homeUrl = `${portalUrl.replace(/\/$/, '')}/home`;
      const redirectUrl = `${homeUrl}?reason=token_expired&appId=${encodeURIComponent(resolvedAppId)}`;
      console.log('[AuthProvider] Token in URL is expired, redirecting to portal for auto-relaunch');
      window.location.href = redirectUrl;
      return;
    }

    console.log('[AuthProvider] Token found in URL, starting exchange...');
    setIsReady(false);
    setIsExchanging(true);

    // Remove token from URL IMMEDIATELY (synchronously) to prevent infinite
    // reload loops when HMR/Fast Refresh re-mounts the component before the
    // async exchange completes.
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('token');
    window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search);

    exchangeToken(token, exchangeEndpoint)
      .then(() => {
        console.log('[AuthProvider] Token exchange successful');
        setRefreshKey(prev => prev + 1);
      })
      .catch((error) => {
        console.error('[AuthProvider] Token exchange failed:', error);
        if (error instanceof TokenExpiredError && portalUrl && resolvedAppId) {
          const homeUrl = `${portalUrl.replace(/\/$/, '')}/home`;
          const redirectUrl = `${homeUrl}?reason=token_expired&appId=${encodeURIComponent(resolvedAppId)}`;
          window.location.href = redirectUrl;
          return;
        }
      })
      .finally(() => {
        setIsExchanging(false);
        setIsReady(true);
        setTokenExchangeComplete(true);
      });
  }, [basePath, exchangeEndpoint, portalUrl, resolvedAppId]);

  // Initialize auth state manager ONLY after token exchange is complete
  useEffect(() => {
    // Don't start until token exchange is complete
    if (!tokenExchangeComplete) {
      console.log('[AuthProvider] Waiting for token exchange to complete before starting auth manager');
      return;
    }

    // Only run in browser
    if (typeof window === 'undefined') {
      return;
    }

    console.log('[AuthProvider] Token exchange complete, starting auth manager');

    // Create the auth state manager
    const manager = createAuthStateManager({
      refreshEndpoint,
      sessionEndpoint,
      exchangeEndpoint,
      portalUrl: portalUrl ? `${portalUrl}/home` : '',
      appId: resolvedAppId,
      checkIntervalMs,
      refreshBufferMs,
      autoRedirect: shouldAutoRedirect,
      basePath,
      silentRefreshUrl,
      tokenExpiresOverrideMs,
      getToken: () => {
        try {
          return localStorage.getItem('auth_token');
        } catch {
          return null;
        }
      },
      setToken: (token) => {
        try {
          if (token) {
            localStorage.setItem('auth_token', token);
          } else {
            localStorage.removeItem('auth_token');
          }
        } catch {
          // Ignore localStorage errors
        }
      },
    });

    // Set as global manager for FetchWrapper to use
    setGlobalAuthManager(manager);
    authManagerRef.current = manager;

    // Subscribe to auth state changes
    const unsubscribeState = manager.on<AuthState>('authStateChanged', (state) => {
      console.log('[AuthProvider] Auth state changed:', state);
      setAuthState(state);
      setRefreshKey(prev => prev + 1);
    });

    // Subscribe to token refresh events
    const unsubscribeRefresh = manager.on('tokenRefreshed', () => {
      console.log('[AuthProvider] Token refreshed successfully');
      setRefreshKey(prev => prev + 1);
    });

    // Subscribe to re-auth requirements
    const unsubscribeReauth = manager.on('requiresReauth', (data: unknown) => {
      const reason = (data as { reason?: string })?.reason;
      console.log('[AuthProvider] Re-authentication required:', reason);
    });

    // Start monitoring - but give a brief delay to let cookies settle
    const startDelay = setTimeout(() => {
      manager.start();
    }, 100);

    return () => {
      clearTimeout(startDelay);
      unsubscribeState();
      unsubscribeRefresh();
      unsubscribeReauth();
      manager.stop();
      clearGlobalAuthManager();
    };
  }, [
    portalUrl, 
    basePath, 
    tokenExchangeComplete, 
    resolvedAppId, 
    sessionEndpoint, 
    refreshEndpoint,
    checkIntervalMs,
    refreshBufferMs,
    shouldAutoRedirect,
  ]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (authManagerRef.current) {
      return authManagerRef.current.refreshNow();
    }
    return false;
  }, []);

  const redirectToPortal = useCallback((reason?: string) => {
    if (typeof window === 'undefined' || !portalUrl) {
      if (!portalUrl) console.warn('[AuthProvider] No portal URL configured, cannot redirect');
      return;
    }
    const portalHome = `${portalUrl.replace(/\/$/, '')}/home`;
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('token');
    currentUrl.searchParams.delete('returnUrl');
    currentUrl.searchParams.delete('reason');
    currentUrl.searchParams.delete('appId');
    const encodedReturn = encodeURIComponent(currentUrl.toString());
    let redirectUrl = `${portalHome}?returnUrl=${encodedReturn}`;
    if (reason) redirectUrl += `&reason=${encodeURIComponent(reason)}`;
    if (resolvedAppId) redirectUrl += `&appId=${encodeURIComponent(resolvedAppId)}`;
    console.log('[AuthProvider] Redirecting to portal:', redirectUrl);
    window.location.href = redirectUrl;
  }, [portalUrl, resolvedAppId]);

  const logout = useCallback(async () => {
    // Clear local storage
    try {
      localStorage.removeItem('auth_token');
    } catch {
      // ignore
    }
    
    // Call logout endpoint
    try {
      await fetch(logoutEndpoint, { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    
    // Stop auth manager
    if (authManagerRef.current) {
      authManagerRef.current.stop();
    }
    
    // Redirect to portal home
    if (portalUrl) {
      window.location.href = `${portalUrl}/home`;
    }
  }, [portalUrl, logoutEndpoint]);

  const isAuthenticated = authState?.isAuthenticated ?? false;

  return (
    <AuthContext.Provider value={{ 
      isReady, 
      isExchanging, 
      refreshKey, 
      authState,
      isAuthenticated,
      refreshToken,
      redirectToPortal,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/** Client-safe JWT payload parse (no Buffer). */
function getJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Check if token is expired (client-side only, no verification). */
function isTokenExpired(token: string): boolean {
  const payload = getJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  const expMs = payload.exp * 1000;
  const nowMs = Date.now();
  return nowMs >= expMs;
}

export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

/**
 * Exchange a URL token for a session cookie.
 * Throws TokenExpiredError when the server returns 401 with error: 'token_expired'.
 */
async function exchangeToken(token: string, endpoint: string): Promise<void> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && (body as { error?: string }).error === 'token_expired') {
      throw new TokenExpiredError('Token expired');
    }
    throw new Error('Token exchange failed');
  }

  try {
    localStorage.setItem('auth_token', token);
  } catch {
    // Ignore localStorage errors
  }
}
