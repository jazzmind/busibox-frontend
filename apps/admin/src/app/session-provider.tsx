'use client';

import { usePathname } from 'next/navigation';
import { SessionProvider } from '@jazzmind/busibox-app/components/auth/SessionProvider';

/**
 * Admin-specific SessionProvider wrapper.
 *
 * On setup routes (/admin/setup, /setup) the admin app uses its own
 * cookie-based auth via the shared busibox-session cookie set by the portal.
 * The SessionProvider's auth state manager can't refresh that token (it
 * requires admin-scoped cookies from a proper SSO exchange) and would
 * redirect to the portal after 30 seconds.
 *
 * Fix: disable auto-redirect and pass no portalUrl on setup routes so the
 * auth state manager stays passive. Authenticated routes get the full
 * SessionProvider with auto-redirect enabled.
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
      portalUrl={isSetup ? undefined : portalUrl}
      autoRedirect={!isSetup}
      checkIntervalMs={checkIntervalMs}
      refreshBufferMs={refreshBufferMs}
      tokenExpiresOverrideMs={tokenExpiresOverrideMs}
    >
      {children}
    </SessionProvider>
  );
}
