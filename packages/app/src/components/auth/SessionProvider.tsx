/**
 * Session Provider Component
 * 
 * Provides authentication context to the entire application.
 * Wraps the app and provides current user session data.
 */

'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { AuthContext } from '@jazzmind/busibox-app/types/next-auth';

type SessionContextType = AuthContext & {
  loading: boolean;
  refreshSession: () => Promise<void>;
  /** Directly update user fields in the session context (e.g., after profile save) */
  updateUser: (fields: Partial<NonNullable<AuthContext['user']>>) => void;
};

const SessionContext = createContext<SessionContextType>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  loading: true,
  refreshSession: async () => {},
  updateUser: () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

export type SessionProviderProps = {
  children: React.ReactNode;
};

// Minimum time between session refreshes (prevents infinite loops from Header)
const REFRESH_DEBOUNCE_MS = 2000;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function SessionProvider({ children }: SessionProviderProps) {
  const [context, setContext] = useState<AuthContext>({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
  });
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  const doFetchSession = useCallback(async () => {
    isFetchingRef.current = true;
    lastFetchRef.current = Date.now();
    
    try {
      const response = await fetch(`${basePath}/api/auth/session`);
      
      // Handle non-OK responses (e.g. 401 when not logged in) without
      // attempting to parse the body as JSON, which can fail if the
      // response is an HTML error page.
      if (!response.ok) {
        // Try to parse JSON for structured error info, but don't fail if it's not JSON
        try {
          const data = await response.json();
          if (data.requireLogout) {
            console.warn('[SessionProvider] Session invalid, redirecting to logout:', data.error);
            window.location.href = `${basePath}/api/auth/logout`;
            return;
          }
        } catch {
          // Response body wasn't JSON (e.g. HTML error page) - just treat as not authenticated
        }
        setContext({
          user: null,
          isAuthenticated: false,
          isAdmin: false,
        });
        return;
      }

      const data = await response.json();
      
      // Check if session is invalid and requires logout
      if (data.requireLogout) {
        console.warn('[SessionProvider] Session invalid, redirecting to logout:', data.error);
        // Redirect to logout to clear all cookies and state
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
        setContext({
          user: null,
          isAuthenticated: false,
          isAdmin: false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
      setContext({
        user: null,
        isAuthenticated: false,
        isAdmin: false,
      });
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Debounced version: prevents rapid re-fetches (e.g., Header useEffect loops)
  const fetchSession = useCallback(async () => {
    const now = Date.now();
    if (isFetchingRef.current || (now - lastFetchRef.current < REFRESH_DEBOUNCE_MS)) {
      return;
    }
    await doFetchSession();
  }, [doFetchSession]);

  // Force version: bypasses debounce for explicit user-initiated refreshes
  // (e.g., after saving profile, the caller needs the session to update NOW)
  const forceRefreshSession = useCallback(async () => {
    if (isFetchingRef.current) return; // still prevent concurrent fetches
    await doFetchSession();
  }, [doFetchSession]);

  // Directly update user fields in the session context without a server round-trip.
  // Useful after profile save: the caller already has the updated data and can
  // push it into the context immediately so the navbar updates.
  const updateUser = useCallback((fields: Partial<NonNullable<AuthContext['user']>>) => {
    setContext((prev) => {
      if (!prev.user) return prev;
      return {
        ...prev,
        user: { ...prev.user, ...fields },
      };
    });
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Memoize the context value to prevent infinite re-renders
  // The Header component in busibox-app has session in useEffect deps,
  // so we need a stable reference
  const contextValue = useMemo(() => ({
    ...context,
    loading,
    refreshSession: forceRefreshSession,
    updateUser,
  }), [context, loading, forceRefreshSession, updateUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
          <p className="text-gray-600">Loading...</p>
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

