/**
 * Logout Page
 * 
 * Performs logout and redirects to login page.
 * This page allows users to logout by visiting /portal/logout directly.
 */

'use client';

import { useEffect, useState } from 'react';

// Get base path for constructing URLs
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function LogoutPage() {
  const [status, setStatus] = useState<'logging-out' | 'success' | 'error'>('logging-out');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Call the logout API
        const response = await fetch(`${basePath}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });

        if (response.ok) {
          setStatus('success');
          // Redirect to login page after a brief delay
          // Use window.location for a full page navigation that respects the current domain
          setTimeout(() => {
            window.location.href = `${basePath}/login`;
          }, 500);
        } else {
          // Even if POST fails, try to redirect - the GET endpoint will clear cookies
          console.warn('[Logout] POST logout failed, redirecting to GET endpoint');
          window.location.href = `${basePath}/api/auth/logout`;
        }
      } catch (err) {
        console.error('[Logout] Error during logout:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setStatus('error');
        // Still try to redirect via GET which clears cookies
        setTimeout(() => {
          window.location.href = `${basePath}/api/auth/logout`;
        }, 2000);
      }
    };

    performLogout();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4 py-12">
      <div className="text-center max-w-md">
        {status === 'logging-out' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
              Logging out...
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Please wait while we securely log you out.
            </p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
              Logged out successfully
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Redirecting to login page...
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
              Logout issue
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {error || 'There was an issue logging out. Redirecting...'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
