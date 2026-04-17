/**
 * Admin Sidebar Navigation Component
 * 
 * Provides sidebar navigation for the admin section with links to:
 * Users, Roles, Apps, Data, Settings, Logs, Tests, and System pages.
 * 
 * Supports both light and dark modes.
 */

'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useCustomization } from '@jazzmind/busibox-app';
import { 
  Users, 
  Shield, 
  LayoutGrid, 
  Database, 
  Settings, 
  ScrollText,
  TestTube,
  Server,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Home,
  BookOpen,
  Fingerprint,
  Network,
} from 'lucide-react';

// Gate the test runner to non-production environments only.
// Set NEXT_PUBLIC_BUSIBOX_ENV=production to hide the Tests link.
const IS_PRODUCTION = process.env.NEXT_PUBLIC_BUSIBOX_ENV === 'production';

type NavItem = {
  divider?: 'top' | 'bottom';
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
  productionHidden?: boolean;
};

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/',
    icon: <BarChart3 className="w-5 h-5" />,
    description: 'Live AI usage overview',
  },
  {
    id: 'users',
    label: 'Users',
    href: '/users',
    icon: <Users className="w-5 h-5" />,
    description: 'Manage user accounts',
  },
  {
    id: 'roles',
    label: 'Roles',
    href: '/roles',
    icon: <Shield className="w-5 h-5" />,
    description: 'Permission groups',
  },
  {
    id: 'apps',
    label: 'Apps',
    href: '/apps',
    icon: <LayoutGrid className="w-5 h-5" />,
    description: 'Application management',
  },
  {
    id: 'data',
    label: 'Data',
    href: '/data',
    icon: <Database className="w-5 h-5" />,
    description: 'Libraries, collections, tags, storage',
  },
  {
    id: 'graph',
    label: 'Graph DB',
    href: '/graph',
    icon: <Network className="w-5 h-5" />,
    description: 'Neo4j health & explorer',
  },

  {
    id: 'logs',
    label: 'Logs',
    href: '/logging',
    icon: <ScrollText className="w-5 h-5" />,
    description: 'Audit and service logs',
  },
  {
    id: 'system',
    label: 'System',
    href: '/system',
    icon: <Server className="w-5 h-5" />,
    description: 'Service health & control',
  },
  {
    id: 'identity-providers',
    label: 'Identity',
    href: '/identity-providers',
    icon: <Fingerprint className="w-5 h-5" />,
    description: 'Sign-in providers (SSO)',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="w-5 h-5" />,
    description: 'System configuration',
  },
  {
    divider: 'top',
    id: 'docs',
    label: 'Documentation',
    href: '/portal/docs',
    icon: <BookOpen className="w-5 h-5" />,
    description: 'System documentation',
  },
  {
    id: 'tests',
    label: 'Tests',
    href: '/tests',
    icon: <TestTube className="w-5 h-5" />,
    description: 'Test harnesses',
    productionHidden: true,
  },

];

type AdminSidebarProps = {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function AdminSidebar({ collapsed = false, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname();
  const { customization } = useCustomization();
  
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname === '';
    }
    return pathname?.startsWith(href);
  };

  return (
    <aside 
      className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <h2 className="font-semibold text-lg text-gray-900 dark:text-white">Admin</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">System Administration</p>
            </div>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.filter((item) => !(IS_PRODUCTION && item.productionHidden)).map((item) => {
          const active = isActive(item.href);
          const isExternal = item.href.startsWith('/portal/');

          return (
            <React.Fragment key={item.id}>
              {item.divider === 'top' && (
                <div className="my-1 h-px w-full bg-gray-200 dark:bg-gray-700" />
              )}
              {isExternal ? (
                <a
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                    active
                      ? 'text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  style={active ? { backgroundColor: customization.primaryColor } : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={`flex-shrink-0 ${active ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{item.label}</span>
                      {item.description && (
                        <p className={`text-xs truncate ${active ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                          {item.description}
                        </p>
                      )}
                    </div>
                  )}
                </a>
              ) : (
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                  active
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
                style={active ? { backgroundColor: customization.primaryColor } : undefined}
                title={collapsed ? item.label : undefined}
              >
                <span className={`flex-shrink-0 ${active ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{item.label}</span>
                    {item.description && (
                      <p className={`text-xs truncate ${active ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                        {item.description}
                      </p>
                    )}
                  </div>
                )}
              </Link>
              )}
              {item.divider === 'bottom' && (
                <div className="my-1 h-px w-full bg-gray-200 dark:bg-gray-700" />
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Footer - Back to Portal */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700">
        <a
          href="/portal/home"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
          title={collapsed ? 'Back to Portal' : undefined}
        >
          <Home className="w-5 h-5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
          {!collapsed && <span className="font-medium">Back to Portal</span>}
        </a>
      </div>
    </aside>
  );
}
