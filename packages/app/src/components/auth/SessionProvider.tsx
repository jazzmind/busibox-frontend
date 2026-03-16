'use client';
/**
 * Session Provider Component
 * 
 * Unified authentication provider for all Busibox apps. Provides:
 * - SSO token exchange from URL ?token= parameter
 * - Session state management via context
 * - Proactive background token refresh via auth-state-manager
 * - Silent SSO refresh when local token expires
 * - Automatic 401 retry via FetchWrapper integration (setGlobalAuthManager)
 * - Redirect to portal when re-authentication is required
 * 
 * All auth operations (session check, token exchange, token refresh) are
 * handled by a single /api/auth/session endpoint:
 *   GET  — Return current session from app-scoped cookie
 *   POST {token} — SSO token exchange (set app-scoped cookies)
 *   POST {} — Token refresh (exchange SSO token for fresh API token)
 * 
 * Backward-compatible: existing apps using <SessionProvider> with no props
 * continue to work and automatically gain background refresh capabilities.
 * 
 * @example
 * ```tsx
 * // Root layout - minimal (portal pattern)
 * <SessionProvider>
 *   {children}
 * </SessionProvider>
 * 
 * // Root layout - with SSO config (agents/admin/chat/media pattern)
 * <SessionProvider appId="busibox-agents" portalUrl={process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL}>
 *   {children}
 * </SessionProvider>
 * 
 * // In your components
 * function MyComponent() {
 *   const { isReady, user, isAuthenticated, refreshKey } = useSession();
 *   if (!isReady) return <Loading />;
 *   // ...
 * }
 * ```
 */


import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { AuthContext as AuthContextType } from '@jazzmind/busibox-app/types/next-auth';
import {
  createAuthStateManager,
  setGlobalAuthManager,
  clearGlobalAuthManager,
  type AuthStateManager,
  type AuthState,
} from '../../lib/authz/auth-state-manager';

// ============================================================================
// Types
// ============================================================================

type SessionContextType = AuthContextType & {
  loading: boolean;
  refreshSession: () => Promise<void>;
  /** Directly update user fields in the session context (e.g., after profile save) */
  updateUser: (fields: Partial<NonNullable<AuthContextType['user']>>) => void;
  /** Whether auth is ready (token exchange complete, initial session loaded) */
  isReady: boolean;
  /** Increments on each auth state change - use as useEffect dependency for data refetch */
  refreshKey: number;
  /** Redirect to portal for re-authentication */
  redirectToPortal: (reason?: string) => void;
  /** Perform a system-wide logout */
  logout: () => Promise<void>;
  /** Force a token refresh via the auth state manager. Returns true if successful. */
  refreshToken: () => Promise<boolean>;
};

const SessionContext = createContext<SessionContextType>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  loading: true,
  refreshSession: async () => {},
  updateUser: () => {},
  isReady: false,
  refreshKey: 0,
  redirectToPortal: () => {},
  logout: async () => {},
  refreshToken: async () => false,
});

export function useSession() {
  return useContext(SessionContext);
}

export type SessionProviderProps = {
  children: React.ReactNode;
  /** App identifier for SSO token exchange and auth manager */
  appId?: string;
  /** Busibox Portal URL for SSO redirects */
  portalUrl?: string;
  /** Base path for the app (e.g., "/agents") */
  basePath?: string;
  /** Session endpoint - GET returns session, POST handles exchange/refresh (default: "/api/auth/session") */
  sessionEndpoint?: string;
  /** Token refresh endpoint - POST with empty body (default: "/api/auth/session") */
  refreshEndpoint?: string;
  /** SSO token exchange endpoint - POST with {token} (default: "/api/auth/session") */
  exchangeEndpoint?: string;
  /** Logout endpoint (default: "/api/logout") */
  logoutEndpoint?: string;
  /** Auth state check interval in ms (default: 30000) */
  checkIntervalMs?: number;
  /** Buffer before token expiry to trigger refresh in ms (default: 300000 = 5 min) */
  refreshBufferMs?: number;
  /** Auto-redirect to portal on auth failure (default: true if portalUrl set) */
  autoRedirect?: boolean;
  /** Override the portal's silent SSO refresh URL */
  silentRefreshUrl?: string;
  /** Testing only: override token lifetime in ms */
  tokenExpiresOverrideMs?: number;
};

const REFRESH_DEBOUNCE_MS = 2000;

const envBasePath = typeof process !== 'undefined' ? (process.env?.NEXT_PUBLIC_BASE_PATH || '') : '';

// ============================================================================
// Helpers
// ============================================================================

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

function isTokenExpired(token: string): boolean {
  const payload = getJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return Date.now() >= payload.exp * 1000;
}

class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

async function exchangeToken(token: string, endpoint: string): Promise<void> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

// ============================================================================
// Provider
// ============================================================================

export function SessionProvider({
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
}: SessionProviderProps) {
  const [context, setContext] = useState<AuthContextType>({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
  });
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tokenExchangeComplete, setTokenExchangeComplete] = useState(false);

  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const authManagerRef = useRef<AuthStateManager | null>(null);

  // Resolve configuration from props or environment.
  // IMPORTANT: portalUrl env fallback only applies when an explicit portalUrl prop
  // was passed. Apps that use <SessionProvider> without portalUrl (e.g. portal itself)
  // must NOT auto-redirect to themselves on auth failure.
  const portalUrl = portalUrlProp
    ? portalUrlProp
    : '';
  const basePath = basePathProp || envBasePath;
  const resolvedAppId = appId || (typeof process !== 'undefined' ? process.env?.APP_NAME : '') || 'busibox-app';
  const shouldAutoRedirect = autoRedirect ?? Boolean(portalUrl);

  // ---- Session fetching (from original SessionProvider) ----

  const doFetchSession = useCallback(async () => {
    isFetchingRef.current = true;
    lastFetchRef.current = Date.now();

    try {
      const response = await fetch(`${basePath}${sessionEndpoint}`);

      if (!response.ok) {
        try {
          const data = await response.json();
          if (data.requireLogout) {
            console.warn('[SessionProvider] Session invalid, redirecting to logout:', data.error);
            window.location.href = `${basePath}/api/auth/logout`;
            return;
          }
        } catch {
          // Not JSON
        }
        setContext({ user: null, isAuthenticated: false, isAdmin: false });
        return;
      }

      const data = await response.json();

      if (data.requireLogout) {
        console.warn('[SessionProvider] Session invalid, redirecting to logout:', data.error);
        window.location.href = `${basePath}/api/auth/logout`;
        return;
      }

      if (data.success && data.data?.user) {
        const user = data.data.user;
        setContext({
          user,
          isAuthenticated: true,
          isAdmin: user.roles?.includes('Admin') || false,
        });
      } else {
        setContext({ user: null, isAuthenticated: false, isAdmin: false });
      }
    } catch (error) {
      console.error('[SessionProvider] Failed to fetch session:', error);
      setContext({ user: null, isAuthenticated: false, isAdmin: false });
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [basePath, sessionEndpoint]);

  const fetchSession = useCallback(async () => {
    const now = Date.now();
    if (isFetchingRef.current || (now - lastFetchRef.current < REFRESH_DEBOUNCE_MS)) {
      return;
    }
    await doFetchSession();
  }, [doFetchSession]);

  const forceRefreshSession = useCallback(async () => {
    if (isFetchingRef.current) return;
    await doFetchSession();
  }, [doFetchSession]);

  const updateUser = useCallback((fields: Partial<NonNullable<AuthContextType['user']>>) => {
    setContext((prev) => {
      if (!prev.user) return prev;
      return { ...prev, user: { ...prev.user, ...fields } };
    });
  }, []);

  // ---- Token exchange from URL (from AuthProvider) ----

  useEffect(() => {
    if (typeof window === 'undefined') {
      setTokenExchangeComplete(true);
      setIsReady(true);
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');

    if (!token) {
      setTokenExchangeComplete(true);
      // Don't set isReady yet - wait for initial session load
      return;
    }

    if (isTokenExpired(token) && portalUrl && resolvedAppId) {
      const homeUrl = `${portalUrl.replace(/\/$/, '')}/home`;
      const redirectUrl = `${homeUrl}?reason=token_expired&appId=${encodeURIComponent(resolvedAppId)}`;
      console.log('[SessionProvider] Token in URL is expired, redirecting to portal');
      window.location.href = redirectUrl;
      return;
    }

    console.log('[SessionProvider] Token found in URL, starting exchange...');
    setIsReady(false);

    // Remove token from URL IMMEDIATELY (synchronously) to prevent infinite
    // reload loops when HMR/Fast Refresh re-mounts the component before the
    // async exchange completes.
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('token');
    window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search);

    exchangeToken(token, `${basePath}${exchangeEndpoint}`)
      .then(() => {
        console.log('[SessionProvider] Token exchange successful');
        setRefreshKey(prev => prev + 1);
      })
      .catch((error) => {
        console.error('[SessionProvider] Token exchange failed:', error);
        if (error instanceof TokenExpiredError && portalUrl && resolvedAppId) {
          const homeUrl = `${portalUrl.replace(/\/$/, '')}/home`;
          window.location.href = `${homeUrl}?reason=token_expired&appId=${encodeURIComponent(resolvedAppId)}`;
          return;
        }
      })
      .finally(() => {
        setTokenExchangeComplete(true);
      });
  }, [basePath, exchangeEndpoint, portalUrl, resolvedAppId]);

  // ---- Initial session load after token exchange ----

  useEffect(() => {
    if (!tokenExchangeComplete) return;

    doFetchSession().then(() => {
      setIsReady(true);
    });
  }, [tokenExchangeComplete, doFetchSession]);

  // ---- Auth state manager integration (from AuthProvider) ----

  useEffect(() => {
    if (!isReady) return;
    if (typeof window === 'undefined') return;

    console.log('[SessionProvider] Starting auth state manager');

    const manager = createAuthStateManager({
      refreshEndpoint: `${basePath}${refreshEndpoint}`,
      sessionEndpoint: `${basePath}${sessionEndpoint}`,
      exchangeEndpoint: `${basePath}${exchangeEndpoint}`,
      portalUrl: portalUrl ? `${portalUrl.replace(/\/$/, '')}/home` : '',
      appId: resolvedAppId,
      checkIntervalMs,
      refreshBufferMs,
      autoRedirect: shouldAutoRedirect,
      basePath,
      silentRefreshUrl,
      tokenExpiresOverrideMs,
      getToken: () => {
        try { return localStorage.getItem('auth_token'); } catch { return null; }
      },
      setToken: (token) => {
        try {
          if (token) localStorage.setItem('auth_token', token);
          else localStorage.removeItem('auth_token');
        } catch { /* ignore */ }
      },
    });

    setGlobalAuthManager(manager);
    authManagerRef.current = manager;

    const unsubscribeState = manager.on<AuthState>('authStateChanged', (state) => {
      console.log('[SessionProvider] Auth state changed:', state);
      if (state.isAuthenticated && state.user) {
        setContext({
          user: {
            id: state.user.id,
            email: state.user.email,
            status: 'ACTIVE',
            roles: state.user.roles,
            displayName: state.user.displayName,
            firstName: state.user.firstName,
            lastName: state.user.lastName,
            avatarUrl: state.user.avatarUrl,
            favoriteColor: state.user.favoriteColor,
          },
          isAuthenticated: true,
          isAdmin: state.user.roles?.includes('Admin') || false,
        });
      } else {
        setContext({ user: null, isAuthenticated: false, isAdmin: false });
      }
      setRefreshKey(prev => prev + 1);
    });

    const unsubscribeRefresh = manager.on('tokenRefreshed', () => {
      console.log('[SessionProvider] Token refreshed successfully');
      setRefreshKey(prev => prev + 1);
    });

    const unsubscribeReauth = manager.on('requiresReauth', (data: unknown) => {
      const reason = (data as { reason?: string })?.reason;
      console.log('[SessionProvider] Re-authentication required:', reason);
      setContext({ user: null, isAuthenticated: false, isAdmin: false });
    });

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
      authManagerRef.current = null;
    };
  }, [
    isReady,
    basePath,
    sessionEndpoint,
    refreshEndpoint,
    exchangeEndpoint,
    portalUrl,
    resolvedAppId,
    checkIntervalMs,
    refreshBufferMs,
    shouldAutoRedirect,
    silentRefreshUrl,
    tokenExpiresOverrideMs,
  ]);

  // ---- Redirect and logout (from AuthProvider) ----

  const redirectToPortal = useCallback((reason?: string) => {
    if (typeof window === 'undefined' || !portalUrl) {
      if (!portalUrl) console.warn('[SessionProvider] No portal URL configured, cannot redirect');
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
    console.log('[SessionProvider] Redirecting to portal:', redirectUrl);
    window.location.href = redirectUrl;
  }, [portalUrl, resolvedAppId]);

  const logout = useCallback(async () => {
    try { localStorage.removeItem('auth_token'); } catch { /* ignore */ }

    try {
      await fetch(`${basePath}${logoutEndpoint}`, { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }

    if (authManagerRef.current) {
      authManagerRef.current.stop();
    }

    if (portalUrl) {
      window.location.href = `${portalUrl.replace(/\/$/, '')}/home`;
    }
  }, [basePath, portalUrl, logoutEndpoint]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (authManagerRef.current) {
      return authManagerRef.current.refreshNow();
    }
    return false;
  }, []);

  // ---- Context value ----

  const contextValue = useMemo(() => ({
    ...context,
    loading,
    refreshSession: forceRefreshSession,
    updateUser,
    isReady,
    refreshKey,
    redirectToPortal,
    logout,
    refreshToken,
  }), [context, loading, forceRefreshSession, updateUser, isReady, refreshKey, redirectToPortal, logout, refreshToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}
