'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@jazzmind/busibox-app/components/auth/ProtectedRoute';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { Header, Footer } from '@jazzmind/busibox-app';
import type { NavigationItem } from '@jazzmind/busibox-app';
import { AppGrid } from '@/components/dashboard/AppGrid';

const adminNavigation: NavigationItem[] = [
  { href: '/admin', label: 'Admin Dashboard' },
];

const RELAUNCH_REASONS = ['token_expired', 'session_expired'];

export default function HomePage() {
  const session = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [relaunchMessage, setRelaunchMessage] = useState<string | null>(null);

  useEffect(() => {
    const reason = searchParams.get('reason');
    const appId = searchParams.get('appId');
    if (!reason || !RELAUNCH_REASONS.includes(reason)) return;

    let cancelled = false;

    const cleanupUrl = () => {
      if (cancelled) return;
      const url = new URL(window.location.href);
      url.searchParams.delete('reason');
      url.searchParams.delete('returnUrl');
      url.searchParams.delete('appId');
      // Strip basePath from pathname since router.replace auto-prepends it
      const bp = process.env.NEXT_PUBLIC_BASE_PATH || '';
      let path = url.pathname;
      if (bp && path.startsWith(bp)) {
        path = path.slice(bp.length) || '/';
      }
      router.replace(path + url.search);
    };

    if (appId) {
      fetch('/api/sso/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
        credentials: 'include',
      })
        .then(async (res) => {
          if (!res.ok) {
            return { success: false };
          }

          const contentType = res.headers.get('content-type') || '';
          if (!contentType.toLowerCase().includes('application/json')) {
            return { success: false };
          }

          try {
            return await res.json();
          } catch {
            return { success: false };
          }
        })
        .then((data) => {
          if (cancelled) return;
          if (data.success && data.data?.redirectUrl) {
            window.location.href = data.data.redirectUrl;
            return;
          }
          setRelaunchMessage('Your session expired. Please click the app again to open it with a fresh token.');
          cleanupUrl();
        })
        .catch(() => {
          if (cancelled) return;
          setRelaunchMessage('Your session expired. Please click the app again to open it with a fresh token.');
          cleanupUrl();
        });
      return () => { cancelled = true; };
    }

    setRelaunchMessage('Your session expired. Please click the app again to open it with a fresh token.');
    cleanupUrl();
  }, [searchParams, router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <Header
          session={session}
          onLogout={handleLogout}
          postLogoutRedirectTo={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/login`}
          adminNavigation={adminNavigation}
          appsLink="/portal/home"
          accountLink="/portal/account"
        />

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          {relaunchMessage && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
            >
              <p className="text-sm font-medium">{relaunchMessage}</p>
            </div>
          )}
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Your Applications
            </h1>
            <p className="mt-2 text-gray-600">
              Access your authorized tools and platforms
            </p>
          </div>

          {/* Applications Grid */}
          <AppGrid />
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </ProtectedRoute>
  );
}
