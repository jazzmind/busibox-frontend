/**
 * Admin Layout
 * 
 * Layout for admin pages with:
 * - Site header at the top (consistent with main app)
 * - Sidebar navigation fixed below header
 * - Independently scrolling main content
 */

'use client';

import { ReactNode, useState } from 'react';
import { ProtectedRoute } from '@jazzmind/busibox-app/components/auth/ProtectedRoute';
import { PasskeyRequiredWrapper } from '@jazzmind/busibox-app/components/auth/PasskeyRequiredWrapper';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { Header } from '@jazzmind/busibox-app';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import type { NavigationItem } from '@jazzmind/busibox-app';
import { Toaster } from 'react-hot-toast';
import { Menu, X } from 'lucide-react';

const adminNavigation: NavigationItem[] = [
  { href: '/admin', label: 'Admin Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/roles', label: 'Roles' },
  { href: '/admin/apps', label: 'Apps' },
  { href: '/admin/data', label: 'Data' },
  { href: '/admin/system', label: 'System' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const session = useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ProtectedRoute>
      <PasskeyRequiredWrapper>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Site Header - Fixed at top */}
          <div className="fixed top-0 left-0 right-0 z-50">
            <Header
              session={session}
              onLogout={async () => session.redirectToPortal()}
              appsLink="/portal/home"
              accountLink="/portal/account"
              adminNavigation={adminNavigation}
            />
          </div>

          {/* Desktop Sidebar - Fixed below header */}
          <div className="hidden lg:block fixed left-0 top-16 bottom-0 z-40">
            <AdminSidebar 
              collapsed={sidebarCollapsed} 
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} 
            />
          </div>

          {/* Mobile Menu Overlay */}
          {mobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          {/* Mobile Sidebar */}
          <div className={`fixed top-16 bottom-0 left-0 z-50 lg:hidden transform transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <AdminSidebar />
          </div>

          {/* Main Content - Offset by header and sidebar */}
          <div className={`pt-16 min-h-screen transition-all duration-300 ${
            sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
          }`}>
            {/* Mobile Header Bar */}
            <div className="lg:hidden sticky top-16 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
              <span className="font-semibold text-sm text-gray-900 dark:text-white">Admin Menu</span>
            </div>

            {/* Page Content */}
            <main className="min-h-[calc(100vh-4rem)]">
              {children}
            </main>
          </div>
          
          <Toaster position="top-right" />
        </div>
      </PasskeyRequiredWrapper>
    </ProtectedRoute>
  );
}
