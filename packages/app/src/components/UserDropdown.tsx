'use client';
/**
 * UserDropdown Component
 * 
 * Reusable user dropdown menu for header navigation.
 * Displays user info, account settings, configurable menu items, and logout.
 * 
 * Fixed items (always shown):
 * - User info header
 * - Account Settings link (goes to Busibox Portal)
 * 
 * Configurable items:
 * - Custom menu items (passed via `menuItems` prop)
 * 
 * Fixed items (always shown):
 * - Logout button (goes to Busibox Portal)
 */


import { useState, useRef, useEffect } from 'react';
import type { User } from '../types';
import { UserAvatar } from './shared/UserAvatar';

export type UserDropdownMenuItem = {
  /** Display label for the menu item */
  label: string;
  /** Link href */
  href: string;
  /** Optional icon element */
  icon?: React.ReactNode;
  /** Optional click handler (if provided, href is ignored) */
  onClick?: () => void;
};

export type UserDropdownMenuSection = {
  /** Optional section title */
  title?: string;
  /** Menu items in this section */
  items: UserDropdownMenuItem[];
};

export type UserDropdownProps = {
  /** User data */
  user: User;
  /** Logout handler */
  onLogout: () => Promise<void>;
  /** Account settings link (default: portal account page) */
  accountLink?: string;
  /** Optional menu sections to show between Account Settings and Logout */
  menuSections?: UserDropdownMenuSection[];
  /** Optional avatar background color */
  avatarBgColor?: string;
  /** Optional avatar text color */
  avatarTextColor?: string;
  /** Optional button hover color */
  buttonHoverBg?: string;
};

/**
 * Get user initials from email
 */
function getDisplayName(user: User): string {
  return (
    user.displayName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.email.split('@')[0]
  );
}

/**
 * Get display role from user roles array
 */
function getRoleDisplay(roles?: string[]): string {
  if (!roles || roles.length === 0) return 'User';
  
  // Prioritize admin role
  if (roles.includes('admin')) return 'Admin';
  
  // Return first role, capitalized
  return roles[0].charAt(0).toUpperCase() + roles[0].slice(1);
}

export function UserDropdown({
  user,
  onLogout,
  accountLink = `${process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3000'}/account`,
  menuSections = [],
  avatarBgColor,
  avatarTextColor = 'white',
  buttonHoverBg = 'rgba(255, 255, 255, 0.1)',
}: UserDropdownProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = getDisplayName(user);
  const roleDisplay = getRoleDisplay(user.roles);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await onLogout();
  };

  const handleMenuItemClick = (item: UserDropdownMenuItem) => {
    setDropdownOpen(false);
    if (item.onClick) {
      item.onClick();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
        style={{
          backgroundColor: dropdownOpen ? buttonHoverBg : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!dropdownOpen) {
            e.currentTarget.style.backgroundColor = buttonHoverBg;
          }
        }}
        onMouseLeave={(e) => {
          if (!dropdownOpen) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        {/* User Avatar */}
        <UserAvatar
          size="md"
          name={displayName}
          email={user.email}
          avatarUrl={user.avatarUrl}
          favoriteColor={user.favoriteColor}
          className="shadow-md"
        />

        {/* User Info */}
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-white">
            {displayName}
          </div>
          <div className="text-xs text-white/70">
            {roleDisplay}
          </div>
        </div>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-white/70 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl py-2 border border-gray-200 z-50">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-900">
              {user.email}
            </div>
            <div className="text-xs text-gray-500 mt-1 space-y-1">
              <div>
                Status:{' '}
                <span
                  className={`font-medium ${
                    user.status === 'ACTIVE' ? 'text-green-600' : 'text-gray-600'
                  }`}
                >
                  {user.status}
                </span>
              </div>
              {user.roles && user.roles.length > 0 && (
                <div>
                  Roles:{' '}
                  <span className="font-medium text-gray-700">
                    {user.roles.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {/* Account Settings - Always First */}
            <a
              href={accountLink}
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              Account Settings
            </a>

            {/* Custom Menu Sections */}
            {menuSections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                <div className="border-t border-gray-100 my-2"></div>
                
                {/* Section Title */}
                {section.title && (
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {section.title}
                  </div>
                )}

                {/* Section Items */}
                {section.items.map((item, itemIndex) => {
                  if (item.onClick) {
                    return (
                      <button
                        key={itemIndex}
                        onClick={() => handleMenuItemClick(item)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full text-left"
                      >
                        {item.icon || (
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        )}
                        {item.label}
                      </button>
                    );
                  }

                  // Use <a> instead of <Link> for menu items — these may
                  // navigate to different Next.js apps (e.g. /admin) and
                  // must not have basePath prepended.
                  return (
                    <a
                      key={itemIndex}
                      href={item.href}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {item.icon || (
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      )}
                      {item.label}
                    </a>
                  );
                })}
              </div>
            ))}

            {/* Logout - Always Last */}
            <div className="border-t border-gray-100 my-2"></div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
