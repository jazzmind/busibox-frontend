'use client';

import { usePathname } from 'next/navigation';
import { SessionProvider, type SessionProviderProps } from '@jazzmind/busibox-app/components/auth/SessionProvider';

const SELF_AUTH_ROUTES = ['/setup', '/admin/setup'];

/**
 * Wraps SessionProvider but disables portalUrl (and therefore autoRedirect +
 * silent SSO refresh) on routes that manage their own authentication — e.g.
 * the first-time setup wizard which uses magic-link cookies directly.
 *
 * Without this, the auth state manager's 30-second check redirects tunnel
 * users (localhost:4443) to the server's canonical domain because the
 * baked-in NEXT_PUBLIC_BUSIBOX_PORTAL_URL doesn't match the tunnel origin.
 */
export function PathAwareSessionProvider({
  children,
  portalUrl,
  ...rest
}: SessionProviderProps) {
  const pathname = usePathname();
  const isSelfAuthRoute = SELF_AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  return (
    <SessionProvider
      {...rest}
      portalUrl={isSelfAuthRoute ? undefined : portalUrl}
      autoRedirect={isSelfAuthRoute ? false : undefined}
    >
      {children}
    </SessionProvider>
  );
}
