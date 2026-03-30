'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Header } from '@jazzmind/busibox-app';
import type { NavigationItem } from '@jazzmind/busibox-app';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';


const adminNavigation: NavigationItem[] = [
  { href: '/admin', label: 'Admin Dashboard' },
];

const navItems = [
  { href: '/', label: 'Agents' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/tools', label: 'Tools' },
  { href: '/evals', label: 'Evals' },
  { href: '/workflows', label: 'Workflows' },
];

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, redirectToPortal } = useSession();
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname.startsWith('/agent');
    return pathname.startsWith(href);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Header
        session={{ user, isAuthenticated }}
        onLogout={async () => redirectToPortal()}
        adminNavigation={adminNavigation}
        appsLink="/portal/home"
        accountLink="/portal/account"
      />
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="flex-1 min-h-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
