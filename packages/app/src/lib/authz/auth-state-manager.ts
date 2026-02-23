/**
 * Auth State Manager for client-side apps.
 *
 * Provides centralized authentication state management including:
 * - Proactive token refresh before expiration
 * - Auth state change detection and broadcasting
 * - Automatic redirect to portal when re-authentication is required
 * - Event-based architecture for loose coupling
 *
 * This acts as a "service worker-like" auth listener that monitors
 * authentication state and prevents users from discovering expired
 * tokens only after submitting a request.
 *
 * Usage:
 * ```typescript
 * const authManager = createAuthStateManager({
 *   refreshEndpoint: '/api/auth/refresh',
 *   sessionEndpoint: '/api/session',
 *   portalUrl: 'https://portal.example.com',
 *   appId: 'busibox-agents',
 * });
 *
 * // Start monitoring
 * authManager.start();
 *
 * // Subscribe to auth state changes
 * authManager.on('authStateChanged', (state) => {
 *   console.log('Auth state:', state.isAuthenticated);
 * });
 *
 * // Subscribe to re-auth requirements
 * authManager.on('requiresReauth', () => {
 *   // Will auto-redirect if autoRedirect is true
 * });
 * ```
 */

import { parseJWTPayload } from './auth-helper';

export type AuthState = {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    roles: string[];
    displayName?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    favoriteColor?: string;
  } | null;
  tokenExpiresAt: number | null; // Unix timestamp in ms
  lastChecked: number; // Unix timestamp in ms
};

export type AuthStateManagerConfig = {
  /**
   * Endpoint to refresh authentication tokens.
   * Should return { success: true, token: string, expiresIn: number }
   * or { requiresReauth: true } on failure.
   */
  refreshEndpoint: string;

  /**
   * Endpoint to get current session state.
   * Should return { user: {...}, isAuthenticated: boolean }
   */
  sessionEndpoint: string;

  /**
   * URL of the Busibox Portal for re-authentication.
   */
  portalUrl: string;

  /**
   * App identifier for return URL construction.
   */
  appId?: string;

  /**
   * How often to check auth state (ms). Default: 30 seconds.
   */
  checkIntervalMs?: number;

  /**
   * How long before token expiry to trigger refresh (ms). Default: 5 minutes.
   */
  refreshBufferMs?: number;

  /**
   * Whether to automatically redirect to portal on auth failure. Default: true.
   */
  autoRedirect?: boolean;

  /**
   * Callback to get the current token (if stored client-side).
   */
  getToken?: () => string | null;

  /**
   * Callback to set/update the token.
   */
  setToken?: (token: string | null) => void;

  /**
   * Optional: Base path for the app (e.g., '/agents').
   */
  basePath?: string;

  /**
   * Optional: URL of the portal's SSO token refresh endpoint.
   * When the local SSO token expires, the auth manager will call this URL
   * to silently obtain a fresh SSO token from the portal (using the portal's
   * session cookie, which the browser sends automatically for same-origin requests).
   * 
   * Defaults to: `${portalUrl}/api/sso/refresh` (constructed from portalUrl minus '/home' suffix)
   */
  silentRefreshUrl?: string;

  /**
   * Optional: Local endpoint to exchange an SSO token for session cookies.
   * Used during silent refresh to store the fresh SSO token.
   * Default: '/api/sso'
   */
  exchangeEndpoint?: string;

  /**
   * Testing only: Override the token lifetime in ms.
   * When set, the auth manager pretends the token expires this many ms after
   * it was first seen, regardless of the actual JWT `exp` claim.
   * E.g., set to 60000 (60s) to test refresh after 1 minute.
   * 
   * Combined with refreshBufferMs, the refresh will trigger at:
   *   tokenExpiresOverrideMs - refreshBufferMs after the token is received.
   * 
   * Do NOT use in production.
   */
  tokenExpiresOverrideMs?: number;
};

export type AuthEventType =
  | 'authStateChanged'
  | 'tokenRefreshed'
  | 'tokenRefreshFailed'
  | 'requiresReauth'
  | 'sessionExpired';

export type AuthEventCallback<T = unknown> = (data: T) => void;

export type AuthStateManager = {
  /**
   * Start monitoring auth state.
   */
  start(): void;

  /**
   * Stop monitoring auth state.
   */
  stop(): void;

  /**
   * Get current auth state.
   */
  getState(): AuthState;

  /**
   * Force an immediate auth state check.
   */
  checkNow(): Promise<void>;

  /**
   * Force a token refresh.
   */
  refreshNow(): Promise<boolean>;

  /**
   * Subscribe to auth events.
   */
  on<T = unknown>(event: AuthEventType, callback: AuthEventCallback<T>): () => void;

  /**
   * Unsubscribe from auth events.
   */
  off(event: AuthEventType, callback: AuthEventCallback): void;

  /**
   * Redirect to portal for re-authentication.
   */
  redirectToPortal(reason?: string): void;

  /**
   * Handle a 401 response from an API call.
   * Returns true if the request should be retried with a new token.
   */
  handle401Response(): Promise<boolean>;

  /**
   * Check if we're currently authenticated.
   */
  isAuthenticated(): boolean;

  /**
   * Perform a system-wide logout.
   * Clears local tokens, calls logout endpoints, and redirects to portal login.
   */
  logout(): Promise<void>;
};

function getTokenExpiry(token: string): number | null {
  const payload = parseJWTPayload(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp * 1000; // Convert to ms
}

/**
 * Create an auth state manager instance.
 */
export function createAuthStateManager(config: AuthStateManagerConfig): AuthStateManager {
  const {
    refreshEndpoint,
    sessionEndpoint,
    portalUrl,
    appId,
    checkIntervalMs = 30_000,
    refreshBufferMs = 5 * 60 * 1000, // 5 minutes
    autoRedirect = true,
    getToken,
    setToken,
    basePath = '',
    exchangeEndpoint = '/api/sso',
    tokenExpiresOverrideMs,
  } = config;

  // Derive the silent refresh URL from portalUrl if not explicitly provided.
  // portalUrl typically ends with '/home' (e.g., 'https://localhost/portal/home'),
  // so strip that to get the portal base, then append the refresh API path.
  const portalBase = portalUrl.replace(/\/home\/?$/, '');
  const silentRefreshUrl = config.silentRefreshUrl || (portalBase ? `${portalBase}/api/sso/refresh` : '');

  // Track when the token was first observed (for tokenExpiresOverrideMs)
  let tokenFirstSeen: number | null = null;

  // State
  let state: AuthState = {
    isAuthenticated: false,
    user: null,
    tokenExpiresAt: null,
    lastChecked: 0,
  };

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isRefreshing = false;
  let pendingRefresh: Promise<boolean> | null = null;
  let isRedirecting = false; // Once set, all further auth activity is suppressed
  let consecutive401AfterRefresh = 0; // Track when refresh "succeeds" but APIs still fail
  const MAX_401_AFTER_REFRESH = 2; // After this many, redirect to portal

  // Event listeners
  const listeners = new Map<AuthEventType, Set<AuthEventCallback>>();

  function emit<T>(event: AuthEventType, data?: T): void {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[AuthStateManager] Error in ${event} listener:`, error);
        }
      });
    }
  }

  function on<T = unknown>(event: AuthEventType, callback: AuthEventCallback<T>): () => void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(callback as AuthEventCallback);
    return () => off(event, callback as AuthEventCallback);
  }

  function off(event: AuthEventType, callback: AuthEventCallback): void {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  function redirectToPortal(reason?: string): void {
    if (typeof window === 'undefined') return;
    if (isRedirecting) return; // Prevent duplicate redirects
    isRedirecting = true;

    // Stop all monitoring immediately so no more checks/retries fire
    stop();

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('token');
    currentUrl.searchParams.delete('returnUrl');
    currentUrl.searchParams.delete('reason');
    currentUrl.searchParams.delete('appId');
    const cleanReturnUrl = currentUrl.toString();
    const encodedReturn = encodeURIComponent(cleanReturnUrl);

    let redirectUrl = `${portalUrl}?returnUrl=${encodedReturn}`;
    if (reason) {
      redirectUrl += `&reason=${encodeURIComponent(reason)}`;
    }
    if (appId) {
      redirectUrl += `&appId=${encodeURIComponent(appId)}`;
    }

    console.log('[AuthStateManager] Redirecting to portal:', redirectUrl);
    window.location.href = redirectUrl;
  }

  async function checkSession(): Promise<void> {
    if (isRedirecting) return;
    try {
      const response = await fetch(sessionEndpoint, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Session check failed: ${response.status}`);
      }

      const data = await response.json();
      const newState: AuthState = {
        isAuthenticated: data.isAuthenticated ?? false,
        user: data.user ?? null,
        tokenExpiresAt: state.tokenExpiresAt, // Preserve token expiry
        lastChecked: Date.now(),
      };

      // Check if token expiry from client-side token
      if (getToken) {
        const token = getToken();
        if (token) {
          const expiry = getTokenExpiry(token);
          if (expiry) {
            // Apply testing override if configured
            if (tokenExpiresOverrideMs) {
              if (!tokenFirstSeen) {
                tokenFirstSeen = Date.now();
                console.log(`[AuthStateManager] Testing: token override active, will expire in ${tokenExpiresOverrideMs}ms`);
              }
              newState.tokenExpiresAt = tokenFirstSeen + tokenExpiresOverrideMs;
            } else {
              newState.tokenExpiresAt = expiry;
            }
          }
        }
      }

      const stateChanged =
        state.isAuthenticated !== newState.isAuthenticated ||
        state.user?.id !== newState.user?.id;

      state = newState;

      // Session check succeeded - reset 401 counter since things are working
      if (state.isAuthenticated) {
        consecutive401AfterRefresh = 0;
      }

      if (stateChanged) {
        emit('authStateChanged', state);
      }

      // If not authenticated, try silent SSO refresh before redirecting
      if (!state.isAuthenticated) {
        console.log('[AuthStateManager] Session check shows not authenticated, attempting silent SSO refresh...');
        const silentRefreshed = await silentRefreshSSO();
        
        if (silentRefreshed) {
          console.log('[AuthStateManager] Silent SSO refresh succeeded after session loss, rechecking...');
          // Re-check session after silent refresh
          const recheckResponse = await fetch(sessionEndpoint, {
            method: 'GET',
            credentials: 'include',
          });
          if (recheckResponse.ok) {
            const recheckData = await recheckResponse.json();
            if (recheckData.isAuthenticated) {
              state = {
                isAuthenticated: true,
                user: recheckData.user ?? null,
                tokenExpiresAt: state.tokenExpiresAt,
                lastChecked: Date.now(),
              };
              emit('authStateChanged', state);
              console.log('[AuthStateManager] Session restored after silent refresh');
              return;
            }
          }
        }
        
        // Silent refresh failed or didn't help - redirect
        if (autoRedirect) {
          emit('sessionExpired', { reason: 'Session not authenticated' });
          redirectToPortal('session_expired');
        }
      }
    } catch (error) {
      console.error('[AuthStateManager] Session check failed:', error);
      // Don't immediately redirect on network errors
    }
  }

  /**
   * Try to silently refresh the SSO token via the portal.
   * 
   * This calls the portal's /api/sso/refresh endpoint. Since the portal and
   * sub-apps are on the same origin, the browser automatically sends the
   * portal's session cookie. If the portal session is still valid, it returns
   * a fresh SSO token which we exchange locally for new cookies.
   * 
   * Returns true if a fresh SSO token was obtained and exchanged.
   */
  async function silentRefreshSSO(): Promise<boolean> {
    if (!silentRefreshUrl || !appId) {
      console.log('[AuthStateManager] Silent refresh not available (no silentRefreshUrl or appId)');
      return false;
    }

    try {
      console.log('[AuthStateManager] Attempting silent SSO refresh via portal...');
      
      // Call the portal's refresh endpoint - browser sends portal cookies automatically
      const response = await fetch(silentRefreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: appId }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('[AuthStateManager] Silent refresh failed:', response.status, errorData);
        return false;
      }

      const data = await response.json();
      const freshToken = data?.data?.token || data?.token;
      
      if (!freshToken) {
        console.log('[AuthStateManager] Silent refresh returned no token');
        return false;
      }

      console.log('[AuthStateManager] Got fresh SSO token from portal, exchanging locally...');

      // Exchange the fresh SSO token for local session cookies
      const exchangeResponse = await fetch(exchangeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: freshToken }),
        credentials: 'include',
      });

      if (!exchangeResponse.ok) {
        console.log('[AuthStateManager] Local token exchange failed:', exchangeResponse.status);
        return false;
      }

      // Update local token storage
      if (setToken) {
        setToken(freshToken);
      }

      // Update expiry from the fresh token
      const expiry = getTokenExpiry(freshToken);
      if (expiry) {
        state = {
          ...state,
          tokenExpiresAt: expiry,
        };
      }

      // Reset the testing override timer so the new token gets a fresh window
      if (tokenExpiresOverrideMs) {
        tokenFirstSeen = Date.now();
        console.log(`[AuthStateManager] Testing: reset token expiry override, next expire in ${tokenExpiresOverrideMs}ms`);
      }

      console.log('[AuthStateManager] Silent SSO refresh successful');
      return true;
    } catch (error) {
      console.error('[AuthStateManager] Silent SSO refresh error:', error);
      return false;
    }
  }

  async function refreshToken(): Promise<boolean> {
    if (isRedirecting) return false;
    // Prevent concurrent refresh attempts
    if (isRefreshing && pendingRefresh) {
      return pendingRefresh;
    }

    isRefreshing = true;
    pendingRefresh = (async () => {
      try {
        const currentToken = getToken?.() ?? '';
        
        const response = await fetch(refreshEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
          },
          credentials: 'include',
        });

        const data = await response.json();

        if (!response.ok) {
          // Check if re-authentication is required (SSO token expired)
          if (data.requiresReauth) {
            console.log('[AuthStateManager] Local refresh says re-auth needed, trying silent SSO refresh...');
            
            // Try silent refresh via portal before giving up
            const silentRefreshed = await silentRefreshSSO();
            
            if (silentRefreshed) {
              // SSO token was refreshed - now retry the local refresh
              console.log('[AuthStateManager] Silent refresh succeeded, retrying local refresh...');
              const retryResponse = await fetch(refreshEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
              });
              
              const retryData = await retryResponse.json();
              
              if (retryResponse.ok) {
                // Update token if we have a setter
                if (retryData.token && setToken) {
                  setToken(retryData.token);
                }
                const expiresIn = retryData.expiresIn ?? 900;
                state = {
                  ...state,
                  tokenExpiresAt: Date.now() + expiresIn * 1000,
                };
                emit('tokenRefreshed', { expiresIn });
                console.log('[AuthStateManager] Token refreshed successfully after silent SSO refresh');
                return true;
              }
              
              console.log('[AuthStateManager] Retry after silent refresh still failed:', retryData);
            }
            
            // Silent refresh failed too - redirect to portal
            emit('requiresReauth', { reason: data.message || 'Token refresh failed' });
            
            if (autoRedirect) {
              redirectToPortal('token_expired');
            }
            
            return false;
          }

          emit('tokenRefreshFailed', { error: data.error || 'Unknown error' });
          return false;
        }

        // Update token if we have a setter
        if (data.token && setToken) {
          setToken(data.token);
        }

        // Update expiry
        const expiresIn = data.expiresIn ?? 900; // Default 15 minutes
        state = {
          ...state,
          tokenExpiresAt: Date.now() + expiresIn * 1000,
        };

        // Reset the testing override timer so the refreshed token gets a fresh window
        if (tokenExpiresOverrideMs) {
          tokenFirstSeen = Date.now();
          console.log(`[AuthStateManager] Testing: reset token expiry override after refresh, next expire in ${tokenExpiresOverrideMs}ms`);
        }

        emit('tokenRefreshed', { expiresIn });
        console.log('[AuthStateManager] Token refreshed successfully');
        return true;
      } catch (error) {
        console.error('[AuthStateManager] Token refresh failed:', error);
        emit('tokenRefreshFailed', { error });
        return false;
      } finally {
        isRefreshing = false;
        pendingRefresh = null;
      }
    })();

    return pendingRefresh;
  }

  async function checkAndRefresh(): Promise<void> {
    if (isRedirecting) return;
    // First, check if we need to refresh the token proactively
    if (state.tokenExpiresAt) {
      const timeUntilExpiry = state.tokenExpiresAt - Date.now();
      
      if (timeUntilExpiry <= 0) {
        // Token already expired
        console.log('[AuthStateManager] Token expired, attempting refresh');
        const refreshed = await refreshToken();
        if (!refreshed) {
          // refreshToken() already handles redirect after trying silent refresh
          return;
        }
      } else if (timeUntilExpiry <= refreshBufferMs) {
        // Token expiring soon, refresh proactively
        console.log('[AuthStateManager] Token expiring soon, refreshing proactively');
        await refreshToken();
      }
    }

    // Then check session state
    await checkSession();
  }

  async function handle401Response(): Promise<boolean> {
    if (isRedirecting) return false;
    console.log('[AuthStateManager] Handling 401 response');

    // If refresh keeps "succeeding" but APIs still return 401,
    // the underlying SSO token is expired and refresh can't fix it.
    consecutive401AfterRefresh++;
    if (consecutive401AfterRefresh > MAX_401_AFTER_REFRESH) {
      console.log('[AuthStateManager] Multiple 401s after refresh - trying silent SSO refresh before redirect');
      
      // Last resort: try silent SSO refresh before giving up
      const silentRefreshed = await silentRefreshSSO();
      if (silentRefreshed) {
        console.log('[AuthStateManager] Silent SSO refresh succeeded, resetting 401 counter');
        consecutive401AfterRefresh = 0;
        // Now try the local refresh with the new SSO token
        return refreshToken();
      }
      
      emit('requiresReauth', { reason: 'SSO token expired - refresh cannot fix' });
      if (autoRedirect) {
        redirectToPortal('token_expired');
      }
      return false;
    }

    // Try to refresh the token (refreshToken now includes silent SSO refresh fallback)
    const refreshed = await refreshToken();
    
    if (!refreshed) {
      // refreshToken() already handles redirect after trying silent refresh
    }
    
    return refreshed;
  }

  function start(): void {
    if (intervalId) {
      console.warn('[AuthStateManager] Already started');
      return;
    }

    console.log('[AuthStateManager] Starting auth state monitoring');
    
    // Initial check
    checkAndRefresh();

    // Set up interval
    intervalId = setInterval(checkAndRefresh, checkIntervalMs);
  }

  function stop(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      console.log('[AuthStateManager] Stopped auth state monitoring');
    }
  }

  function getState(): AuthState {
    return { ...state };
  }

  async function checkNow(): Promise<void> {
    await checkAndRefresh();
  }

  async function refreshNow(): Promise<boolean> {
    return refreshToken();
  }

  function isAuthenticated(): boolean {
    return state.isAuthenticated;
  }

  async function logout(): Promise<void> {
    console.log('[AuthStateManager] Performing system-wide logout');
    
    // Stop monitoring
    stop();
    
    // Clear local token
    if (setToken) {
      setToken(null);
    }
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('auth_token');
        // Clear any other auth-related items
        const keysToRemove = Object.keys(localStorage).filter(key => 
          key.includes('auth') || key.includes('token') || key.includes('session')
        );
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch {
        // Ignore localStorage errors
      }
      
      // Clear sessionStorage auth items
      try {
        const sessionKeysToRemove = Object.keys(sessionStorage).filter(key => 
          key.includes('auth') || key.includes('token') || key.includes('busibox')
        );
        sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
      } catch {
        // Ignore sessionStorage errors
      }
    }
    
    // Call the local app's logout endpoint to clear cookies
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.warn('[AuthStateManager] Local logout failed:', error);
    }
    
    // Call the portal's logout endpoint to invalidate the session system-wide
    try {
      await fetch(`${portalBase}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.warn('[AuthStateManager] Portal logout failed:', error);
      // This might fail due to CORS, which is okay - we'll redirect anyway
    }
    
    // Update state
    state = {
      isAuthenticated: false,
      user: null,
      tokenExpiresAt: null,
      lastChecked: Date.now(),
    };
    
    emit('authStateChanged', state);
    
    // Redirect to portal login page (use portalBase - portalUrl may include /home)
    if (typeof window !== 'undefined') {
      window.location.href = `${portalBase}/login`;
    }
  }

  return {
    start,
    stop,
    getState,
    checkNow,
    refreshNow,
    on,
    off,
    redirectToPortal,
    handle401Response,
    isAuthenticated,
    logout,
  };
}

// Singleton instance for global access
let globalAuthManager: AuthStateManager | null = null;

// Flag to indicate auth is initializing (token exchange in progress)
// When true, FetchWrapper should NOT trigger redirects on 401
let authInitializing = false;

/**
 * Get or create the global auth state manager.
 * Use this when you need app-wide auth state monitoring.
 */
export function getGlobalAuthManager(config?: AuthStateManagerConfig): AuthStateManager | null {
  if (!globalAuthManager && config) {
    globalAuthManager = createAuthStateManager(config);
  }
  return globalAuthManager;
}

/**
 * Set the global auth state manager.
 */
export function setGlobalAuthManager(manager: AuthStateManager): void {
  globalAuthManager = manager;
}

/**
 * Clear the global auth state manager.
 */
export function clearGlobalAuthManager(): void {
  if (globalAuthManager) {
    globalAuthManager.stop();
    globalAuthManager = null;
  }
}

/**
 * Check if auth is currently initializing (token exchange in progress).
 * When true, 401 responses should NOT trigger redirects - just return them as-is.
 */
export function isAuthInitializing(): boolean {
  return authInitializing;
}

/**
 * Set the auth initializing flag.
 * Call with `true` before token exchange, `false` after.
 */
export function setAuthInitializing(initializing: boolean): void {
  authInitializing = initializing;
  console.log('[AuthStateManager] Auth initializing:', initializing);
}
