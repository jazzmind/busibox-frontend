/**
 * Chat Layout
 * 
 * Root layout for chat with branded header and toast notifications.
 * Auth is handled by the page itself (server-side redirect).
 */

'use client';

import { Toaster } from 'react-hot-toast';
import { Header } from '@jazzmind/busibox-app';
import type { NavigationItem } from '@jazzmind/busibox-app';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';

const adminNavigation: NavigationItem[] = [
  { href: '/admin', label: 'Admin Dashboard' }
];

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useSession();

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Branded Header */}
      <Header
        session={session}
        onLogout={async () => session.redirectToPortal()}
        adminNavigation={adminNavigation}
        appsLink="/portal/home"
        accountLink="/portal/account"
      />
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <main className="flex-1 overflow-hidden h-full min-w-0 w-full">
          {children}
        </main>
      </div>
      
      <Toaster position="top-right" />
    </div>
  );
}
