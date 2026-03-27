'use client';

import { usePathname } from 'next/navigation';
import { SessionProvider } from '@jazzmind/busibox-app/components/auth/SessionProvider';

/**
 * Admin-specific SessionProvider wrapper.
 *
 * On setup routes the admin app starts with only the shared busibox-session
 * cookie (no admin-scoped cookies until SSO exchange completes). The auth
 * state manager's local refresh (POST /api/auth/session) will fail for this
 * cookie, but the silent SSO refresh via the portal WILL work because the
 * browser sends the portal's busibox-session cookie to the portal's refresh
 * endpoint automatically.
 *
 * We keep portalUrl on setup routes so silentRefreshUrl is constructed and
 * the silent SSO refresh path is available. We only disable autoRedirect so
 * a failed refresh doesn't bounce the user away from the setup wizard.
 */
export function AdminSessionProvider({
  children,
  portalUrl,
  checkIntervalMs,
  refreshBufferMs,
  tokenExpiresOverrideMs,
}: {
  children: React.ReactNode;
  portalUrl: string;
  checkIntervalMs?: number;
  refreshBufferMs?: number;
  tokenExpiresOverrideMs?: number;
}) {
  const pathname = usePathname();
  const isSetup = pathname === '/setup' || pathname?.startsWith('/setup/');

  return (
    <SessionProvider
      appId="busibox-admin"
      portalUrl={portalUrl}
      autoRedirect={!isSetup}
      checkIntervalMs={checkIntervalMs}
      refreshBufferMs={refreshBufferMs}
      tokenExpiresOverrideMs={tokenExpiresOverrideMs}
    >
      {children}
    </SessionProvider>
  );
}
