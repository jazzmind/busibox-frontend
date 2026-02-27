/**
 * Setup redirect — consumes the magic link token from `make install`,
 * establishes a portal session (busibox-session cookie), then hands off
 * to the admin setup wizard. The admin app shares the same cookie so no
 * SSO token is needed.
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SetupRedirect() {
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      consumeTokenAndRedirect(token);
    } else {
      // No token — maybe we already have a session from a previous visit.
      // Just forward to admin setup; it will check the session itself.
      window.location.href = '/admin/setup';
    }
  }, [searchParams]);

  const consumeTokenAndRedirect = async (token: string) => {
    try {
      const response = await fetch(
        `/api/auth/verify-magic-link?token=${encodeURIComponent(token)}`,
        { credentials: 'include' },
      );
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Invalid or expired setup link.');
        return;
      }

      // Session cookie is now set — redirect to admin setup (no token needed)
      window.location.href = '/admin/setup';
    } catch (err) {
      console.error('[Setup] Magic link verification failed:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-16 h-16 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Link Invalid</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            Run <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">make login</code> to generate a new setup link.
          </p>
        </div>
      </div>
    );
  }

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
        <p className="text-gray-600">Verifying setup link...</p>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupRedirect />
    </Suspense>
  );
}
