'use client';

import { ReactNode } from 'react';
import { Header, Footer } from '@jazzmind/busibox-app';
import type { NavigationItem } from '@jazzmind/busibox-app';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { Toaster } from 'react-hot-toast';

const adminNavigation: NavigationItem[] = [
  { href: '/admin', label: 'Admin Dashboard' },
];

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, redirectToPortal } = useSession();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header
        session={{ user, isAuthenticated }}
        onLogout={async () => redirectToPortal()}
        adminNavigation={adminNavigation}
        appsLink="/portal/home"
        accountLink="/portal/account"
      />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <Toaster position="top-right" />
    </div>
  );
}
