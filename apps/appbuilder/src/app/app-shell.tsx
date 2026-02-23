'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { FetchWrapper, Footer, VersionBar, AuthProvider, useAuth } from '@jazzmind/busibox-app';
import type { SessionData } from '@jazzmind/busibox-app';
import { CustomHeader } from '@/components/CustomHeader';

function normalizePortalUrl(raw: string): string {
  const base = raw.replace(/\/+$/, '');
  if (!base) return '';
  return base.endsWith('/portal') ? base : `${base}/portal`;
}

function AppShellContent({ children, basePath }: { children: React.ReactNode; basePath: string }) {
  const { isReady, refreshKey, authState, redirectToPortal, logout } = useAuth();
  const [session, setSession] = useState<SessionData>({ user: null, isAuthenticated: false });
  
  const portalUrl = normalizePortalUrl(process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL || process.env.NEXT_PUBLIC_AI_PORTAL_URL || '');
  
  const appHomeLink = '/';

  const skipAuthUrls = useMemo(() => [
    `${basePath}/api/auth/refresh`,
    `${basePath}/api/auth/exchange`,
    `${basePath}/api/auth/token`,
    `${basePath}/api/session`,
    `${basePath}/api/logout`,
    `${basePath}/api/health`,
    '/api/auth/refresh',
    '/api/auth/exchange',
    '/api/auth/token',
    '/api/session',
    '/api/logout',
    '/api/health',
  ], [basePath]);

  // Use system-wide logout from auth context
  const onLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  // Sync session from auth state when it changes
  useEffect(() => {
    if (authState?.isAuthenticated && authState.user) {
      setSession({
        user: {
          id: authState.user.id,
          email: authState.user.email,
          status: 'ACTIVE',
          roles: authState.user.roles,
          displayName: authState.user.displayName,
          firstName: authState.user.firstName,
          lastName: authState.user.lastName,
          avatarUrl: authState.user.avatarUrl,
          favoriteColor: authState.user.favoriteColor,
        },
        isAuthenticated: true,
      });
    }
  }, [authState]);

  // Load session after auth is ready, and reload when refreshKey changes
  useEffect(() => {
    if (!isReady) return;
    
    let cancelled = false;
    async function loadSession() {
      try {
        const res = await fetch(`${basePath}/api/session`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (!cancelled) setSession(data);
      } catch {
        if (!cancelled) setSession({ user: null, isAuthenticated: false });
      }
    }
    loadSession();
    return () => {
      cancelled = true;
    };
  }, [isReady, refreshKey, basePath]);

  // Handle auth errors - redirect to portal
  const handleAuthError = useCallback(() => {
    console.log('[AppShell] Auth error, redirecting to portal');
    redirectToPortal('session_expired');
  }, [redirectToPortal]);

  return (
    <>
      <FetchWrapper 
        skipAuthUrls={skipAuthUrls}
        onAuthError={handleAuthError}
        autoRetry={true}
      />
      <CustomHeader
        session={session}
        onLogout={onLogout}
        portalUrl={portalUrl}
        accountLink={`${portalUrl}/account`}
        appHomeLink={appHomeLink}
        appName="App Builder"
        adminNavigation={[]}
      />
      {/* App navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400">
            Home
          </Link>
          <Link href="/library" className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400">
            Library
          </Link>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
      <Footer />
      <VersionBar />
    </>
  );
}

export function AppShell({ children, basePath }: { children: React.ReactNode; basePath: string }) {
  const portalUrl = process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL || process.env.NEXT_PUBLIC_AI_PORTAL_URL || '';
  const appId = process.env.APP_NAME || 'busibox-appbuilder';
  
  return (
    <AuthProvider
      appId={appId}
      portalUrl={portalUrl}
      basePath={basePath}
    >
      <AppShellContent basePath={basePath}>{children}</AppShellContent>
    </AuthProvider>
  );
}
