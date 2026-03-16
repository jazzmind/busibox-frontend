'use client';
/**
 * Protected Route Component
 * 
 * Wraps pages/components that require authentication.
 * Redirects to login if not authenticated.
 * 
 * For the portal app, uses client-side router navigation.
 * For other apps, uses window.location.href to redirect to the portal login.
 */


import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from './SessionProvider';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const isPortalApp = !basePath || basePath === '/';

export type ProtectedRouteProps = {
  children: React.ReactNode;
  requireAdmin?: boolean;
  fallback?: React.ReactNode;
  loginUrl?: string;
  homeUrl?: string;
  /** When provided and user is not authenticated, renders this instead of
   *  redirecting to login. Use for inline re-auth flows (e.g. passkey prompt). */
  sessionExpiredFallback?: React.ReactNode;
};

export function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  fallback,
  loginUrl,
  homeUrl,
  sessionExpiredFallback,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isAdmin } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const resolvedLoginUrl = loginUrl ?? (isPortalApp ? '/login' : '/portal/login');
  const resolvedHomeUrl = homeUrl ?? (isPortalApp ? '/home' : '/portal/home');

  useEffect(() => {
    if (!isAuthenticated && !sessionExpiredFallback) {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const returnTo = search ? `${window.location.origin}${basePath}${pathname || ''}${search}` : undefined;
      const target = returnTo ? `${resolvedLoginUrl}?returnTo=${encodeURIComponent(returnTo)}` : resolvedLoginUrl;
      
      if (isPortalApp) {
        router.push(target);
      } else {
        window.location.href = target;
      }
    } else if (requireAdmin && !isAdmin) {
      if (isPortalApp) {
        router.push(resolvedHomeUrl);
      } else {
        window.location.href = resolvedHomeUrl;
      }
    }
  }, [isAuthenticated, isAdmin, requireAdmin, router, pathname, resolvedLoginUrl, resolvedHomeUrl, sessionExpiredFallback]);

  if (!isAuthenticated) {
    if (sessionExpiredFallback) {
      return <>{sessionExpiredFallback}</>;
    }
    return fallback || (
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
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-red-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
