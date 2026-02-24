/**
 * Session Expired Prompt
 *
 * Shown when the user's session expires while on an authenticated page.
 * If the browser supports passkeys, offers inline re-authentication.
 * Otherwise redirects to the login page.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePasskey } from '@/hooks/usePasskey';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { Button } from '@jazzmind/busibox-app';

export function SessionExpiredPrompt() {
  const router = useRouter();
  const { refreshSession } = useSession();
  const {
    isSupported: passkeySupported,
    isPlatformAvailable: passkeyAvailable,
    isLoading: passkeyLoading,
    error: passkeyError,
    authenticateWithPasskey,
    clearError: clearPasskeyError,
  } = usePasskey();

  const [checking, setChecking] = useState(true);
  const [showPasskey, setShowPasskey] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (passkeySupported && passkeyAvailable) {
      setShowPasskey(true);
    }
    setChecking(false);
  }, [passkeySupported, passkeyAvailable]);

  // If WebAuthn isn't available, redirect to login after a brief delay
  useEffect(() => {
    if (checking) return;
    if (showPasskey) return;

    const timer = setTimeout(() => {
      router.push('/login');
    }, 1500);
    return () => clearTimeout(timer);
  }, [checking, showPasskey, router]);

  const handlePasskeyLogin = useCallback(async () => {
    clearPasskeyError();
    const ok = await authenticateWithPasskey();
    if (ok) {
      setSuccess(true);
      await refreshSession();
      // Small delay so the success state is visible
      setTimeout(() => {
        window.location.reload();
      }, 600);
    }
  }, [authenticateWithPasskey, clearPasskeyError, refreshSession]);

  const handleGoToLogin = () => {
    router.push('/login');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-600">Checking session...</p>
        </div>
      </div>
    );
  }

  if (!showPasskey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-600">Session expired. Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {success ? (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <svg className="w-16 h-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome back!</h2>
            <p className="text-gray-600">Session restored. Loading your apps...</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <svg className="w-16 h-16 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Session Expired
              </h2>
              <p className="text-gray-600">
                Your session has timed out. Use your passkey to continue where you left off.
              </p>
            </div>

            {passkeyError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {passkeyError}
              </div>
            )}

            <div className="space-y-3">
              <Button
                variant="primary"
                fullWidth
                onClick={handlePasskeyLogin}
                loading={passkeyLoading}
                disabled={passkeyLoading}
              >
                {passkeyLoading ? 'Authenticating...' : 'Re-authenticate with passkey'}
              </Button>

              <Button
                variant="ghost"
                fullWidth
                onClick={handleGoToLogin}
                disabled={passkeyLoading}
              >
                Go to login page
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
