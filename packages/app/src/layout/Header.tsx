'use client';
/**
 * Header Component
 * 
 * Top navigation bar with logo, user menu, and admin access.
 * Accepts session data and navigation configuration as props.
 */


import React from 'react';
import { useCustomization } from '../contexts/CustomizationContext';
import { ThemeToggle } from './ThemeToggle';
import { UserDropdown } from '../components/UserDropdown';
import type { UserDropdownMenuSection } from '../components/UserDropdown';
import { LayoutGrid } from 'lucide-react';
import type { SessionData } from '../types';

export type NavigationItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
};

export type HeaderProps = {
  /** Session data containing user information */
  session: SessionData;
  /** Logout handler function */
  onLogout: () => Promise<void>;
  /**
   * Optional redirect after logout.
   * Busibox Portal typically redirects to /login, but other apps may want no redirect (default) or a different URL.
   */
  postLogoutRedirectTo?: string;
  /** Optional navigation items to show for admin users */
  adminNavigation?: NavigationItem[];
  /** Optional link to apps/home page */
  appsLink?: string;
  /** Optional account settings link */
  accountLink?: string;
};

const DEFAULT_ADMIN_NAV: NavigationItem = { href: '/admin', label: 'Admin Dashboard' };

export function Header({ 
  session, 
  onLogout,
  postLogoutRedirectTo,
  adminNavigation = [],
  appsLink = '/portal/home',
  accountLink = '/portal/account'
}: HeaderProps) {
  const { customization } = useCustomization();

  const { user } = session;
  const isAdmin = user?.roles?.includes('Admin');

  const fullAdminNav = React.useMemo(() => {
    const hasAdminDashboard = adminNavigation.some(item => item.label === 'Admin Dashboard');
    return hasAdminDashboard ? adminNavigation : [DEFAULT_ADMIN_NAV, ...adminNavigation];
  }, [adminNavigation]);

  const handleLogout = async () => {
    try {
      await onLogout();
      if (postLogoutRedirectTo) {
        window.location.href = postLogoutRedirectTo;
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header 
      className="shadow-lg sticky top-0 z-50"
      style={{ backgroundColor: customization.primaryColor }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <a href={appsLink} className="flex items-center space-x-3 group">
            {customization.logoUrl ? (
              <img 
                src={customization.logoUrl} 
                alt={customization.companyName} 
                className="h-10 w-auto transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center transition-transform group-hover:scale-105">
                <div className="w-8 h-8 rounded-full relative" style={{ borderWidth: '4px', borderColor: customization.primaryColor }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-sm transform rotate-45" style={{ backgroundColor: customization.primaryColor }}></div>
                  </div>
                </div>
              </div>
            )}
            <div>
              <h1 
                className="text-xl font-bold tracking-wide"
                style={{ color: customization.textColor }}
              >
                {customization.siteName}
              </h1>
              <p 
                className="text-[10px] tracking-wider -mt-1 opacity-80"
                style={{ color: customization.textColor }}
              >
                {customization.slogan}
              </p>
            </div>
          </a>

          {/* Right side - Apps Nav + Theme Toggle + User Menu */}
          <div className="flex items-center gap-4">
            {/* Apps Navigation */}
            <a
              href={appsLink}
              className="flex items-center gap-2 p-2 rounded-lg text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
              title="Back to Apps"
            >
              <LayoutGrid className="w-5 h-5 text-white" />
              <span className="sr-only sm:not-sr-only">Apps</span>
            </a>
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Dropdown */}
            {user && (
              <UserDropdown
                user={user}
                onLogout={handleLogout}
                accountLink={accountLink}
                menuSections={
                  isAdmin
                    ? [
                        {
                          title: 'Administration',
                          items: fullAdminNav.map(item => ({
                            label: item.label,
                            href: item.href,
                            icon: item.icon,
                          })),
                        },
                        {
                          title: 'Help',
                          items: [
                            {
                              label: 'User Guide',
                              href: '/portal/docs/platform',
                            },
                          ],
                        },
                      ]
                    : [
                      {
                        title: 'Help',
                        items: [
                          {
                            label: 'User Guide',
                            href: '/portal/docs/platform',
                          },
                        ],
                      },
                    ]
                }
                avatarBgColor="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                buttonHoverBg="rgba(255, 255, 255, 0.1)"
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
