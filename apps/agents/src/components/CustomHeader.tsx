'use client';

import React from 'react';
import Link from 'next/link';
import { useCustomization } from '@jazzmind/busibox-app';
import { ThemeToggle, UserDropdown } from '@jazzmind/busibox-app';
import type { UserDropdownMenuSection, User } from '@jazzmind/busibox-app';
import { LayoutGrid } from 'lucide-react';
import type { SessionData } from '@jazzmind/busibox-app';

export type CustomHeaderProps = {
  session: SessionData;
  onLogout: () => Promise<void>;
  portalUrl: string;
  accountLink: string;
  adminNavigation?: Array<{ href: string; label: string }>;
  appHomeLink: string; // Link for app name (goes to /agents)
};

export function CustomHeader({ 
  session, 
  onLogout,
  portalUrl,
  accountLink,
  adminNavigation = [],
  appHomeLink,
}: CustomHeaderProps) {
  const { customization } = useCustomization();

  const { user } = session;
  const isAdmin = user?.roles?.includes('Admin');

  const handleLogout = async () => {
    try {
      await onLogout();
      window.location.href = `${portalUrl}/home`;
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
          <div className="flex items-center space-x-3 group">
            {/* Logo links to portal */}
            <Link href={`${portalUrl}/home`} className="flex items-center">
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
            </Link>
            {/* App name links to app home */}
            <Link href={appHomeLink} className="ml-3">
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
            </Link>
          </div>

          {/* Right side - Apps Nav + Theme Toggle + User Menu */}
          <div className="flex items-center gap-4">
            {/* Apps Navigation - Back to Portal */}
            <Link
              href={`${portalUrl}/home`}
              className="flex items-center gap-2 p-2 rounded-lg text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
              title="Back to Portal"
            >
              <LayoutGrid className="w-5 h-5 text-white" />
              <span className="sr-only sm:not-sr-only">Apps</span>
            </Link>
            
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            {user ? (
              <UserDropdown
                user={user as User}
                onLogout={handleLogout}
                accountLink={accountLink}
                menuSections={
                  isAdmin && adminNavigation.length > 0
                    ? [
                        {
                          title: 'Administration',
                          items: adminNavigation.map(nav => ({
                            label: nav.label,
                            href: nav.href,
                          })),
                        },
                        {
                          title: 'Help',
                          items: [
                            {
                              label: 'User Guide',
                              href: '/portal/docs/apps/agents',
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
                          href: '/portal/docs/apps/agents',
                        },
                      ],
                    },]
                }
                avatarBgColor={customization.secondaryColor}
                avatarTextColor={customization.textColor}
                buttonHoverBg="rgba(255, 255, 255, 0.1)"
              />
            ) : (
              <Link
                href={`${portalUrl}/home`}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

