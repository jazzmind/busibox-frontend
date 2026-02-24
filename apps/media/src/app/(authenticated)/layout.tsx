'use client';

import { ReactNode } from 'react';
import { Header, Footer } from '@jazzmind/busibox-app';
import type { NavigationItem } from '@jazzmind/busibox-app';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { Toaster } from 'react-hot-toast';

const portalBaseUrl = (process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL || process.env.NEXT_PUBLIC_AI_PORTAL_URL || '').replace(/\/+$/, '');
const portalUrl = portalBaseUrl
  ? (portalBaseUrl.endsWith('/portal') ? portalBaseUrl : `${portalBaseUrl}/portal`)
  : '/portal';

const adminNavigation: NavigationItem[] = [
  { href: `${portalUrl}/admin`, label: 'Admin Dashboard' },
];

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, logout } = useSession();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header
        session={{ user, isAuthenticated }}
        onLogout={handleLogout}
        postLogoutRedirectTo={`${portalUrl}/login`}
        adminNavigation={adminNavigation}
        appsLink={`${portalUrl}/home`}
        accountLink={`${portalUrl}/account`}
      />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <Toaster position="top-right" />
    </div>
  );
}
