/**
 * DocLayout Component
 * 
 * Layout wrapper for documentation pages with sidebar navigation.
 * Shows logged-in Header when authenticated, PublicHeader when not.
 * 
 * Category tabs (Platform, Administrator, Apps, Developer) are displayed as a full-width
 * horizontal navigation bar below the header. The sidebar contains only
 * the doc navigation for the active category.
 * 
 * Supports documentation categories:
 *   - Platform: End-user guides
 *   - Administrator: Operational/deployment guides
 *   - Apps: Per-app documentation (grouped by app in sidebar)
 *   - Developer: Technical documentation
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Header, Footer } from '@jazzmind/busibox-app';
import type { NavigationItem } from '@jazzmind/busibox-app';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import type { DocCategory, DocNavItem, AppDocsGroup } from '@jazzmind/busibox-app/lib/docs/client';

const adminNavigation: NavigationItem[] = [
  { href: '/admin', label: 'Admin Dashboard' },
  { href: '/admin/users', label: 'Manage Users' },
  { href: '/admin/apps', label: 'Manage Apps' },
  { href: '/admin/logs', label: 'Service Logs' },
  { href: '/admin/audit-logs', label: 'Audit Logs' },
];

interface DocLayoutProps {
  children: React.ReactNode;
  category: DocCategory;
  navigation: DocNavItem[];
  currentSlug?: string;
  appGroups?: AppDocsGroup[];
}

// Category labels for breadcrumbs and headings
const categoryLabels: Record<DocCategory, string> = {
  platform: 'Platform',
  administrator: 'Administrator',
  apps: 'Apps',
  developer: 'Developer',
};

// Category descriptions for the tab bar
const categoryDescriptions: Record<DocCategory, string> = {
  platform: 'User guides and platform features',
  administrator: 'Operational and deployment documentation',
  apps: 'Documentation from installed applications',
  developer: 'Technical docs for deploying and extending',
};

// Inline SVG icons
const BookIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const AppsIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const CodeIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const ShieldIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ChevronIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function DocLayout({ children, category, navigation, currentSlug, appGroups }: DocLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isAuthenticated, loading } = useSession();

  const categories = [
    { id: 'platform' as const, label: 'Platform', description: categoryDescriptions.platform, icon: BookIcon },
    { id: 'administrator' as const, label: 'Administrator', description: categoryDescriptions.administrator, icon: ShieldIcon },
    { id: 'apps' as const, label: 'Apps', description: categoryDescriptions.apps, icon: AppsIcon },
    { id: 'developer' as const, label: 'Developer', description: categoryDescriptions.developer, icon: CodeIcon },
  ];

  const showLoggedInHeader = !loading && isAuthenticated && user;

  // For the apps category, render grouped sidebar; otherwise flat list
  const renderNavigation = () => {
    if (category === 'apps' && appGroups && appGroups.length > 0) {
      return (
        <nav className="space-y-4">
          {appGroups.map((group) => (
            <div key={group.app_id}>
              <h3 className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {group.app_name}
              </h3>
              <div className="mt-1 space-y-0.5">
                {group.docs.map((item) => {
                  const href = `/docs/${category}/${item.slug}`;
                  const isActive = currentSlug === item.slug;
                  
                  return (
                    <Link
                      key={item.slug}
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-orange-50 text-orange-600 font-medium'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      );
    }

    if (navigation.length === 0) {
      return (
        <p className="text-sm text-gray-500 py-4">
          No documentation available yet.
        </p>
      );
    }

    return (
      <nav className="space-y-1">
        {navigation.map((item) => {
          const href = `/docs/${category}/${item.slug}`;
          const isActive = currentSlug === item.slug;
          
          return (
            <Link
              key={item.slug}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-orange-50 text-orange-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.title}
            </Link>
          );
        })}
      </nav>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {showLoggedInHeader ? (
        <Header
          session={{ user, isAuthenticated }}
          onLogout={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
          }}
          postLogoutRedirectTo={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/login`}
          adminNavigation={adminNavigation}
          appsLink="/portal/home"
          accountLink="/portal/account"
        />
      ) : (
        <PublicHeader />
      )}

      {/* Category Tab Bar - full width below header */}
      <div className="border-b border-gray-200 bg-gray-50/80 sticky top-14 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1">
            {categories.map((cat) => {
              const isActive = category === cat.id;
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.id}
                  href={`/docs/${cat.id}`}
                  className={`
                    relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors
                    ${isActive
                      ? 'text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{cat.label}</span>
                  {/* Active indicator - bottom border */}
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-orange-500 rounded-t" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed bottom-4 right-4 z-50 p-3 bg-orange-500 text-white rounded-full shadow-lg hover:bg-orange-600"
        >
          {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
        </button>

        {/* Sidebar - only doc navigation, no tabs */}
        <aside className={`
          fixed lg:sticky top-[6.75rem] h-[calc(100vh-6.75rem)] w-64 
          bg-gray-50 border-r border-gray-200 overflow-y-auto
          transform transition-transform lg:transform-none z-40
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-4">
            {/* Category heading in sidebar */}
            <h2 className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {categoryLabels[category]} Docs
            </h2>

            {/* Navigation */}
            {renderNavigation()}
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-6 py-10">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-sm text-gray-400 mb-8">
              <Link href="/docs" className="hover:text-gray-600">Docs</Link>
              <ChevronIcon />
              <Link href={`/docs/${category}`} className="hover:text-gray-600">
                {categoryLabels[category]}
              </Link>
              {currentSlug && (
                <>
                  <ChevronIcon />
                  <span className="text-gray-600 truncate max-w-[200px]">
                    {navigation.find(n => n.slug === currentSlug)?.title || currentSlug}
                  </span>
                </>
              )}
            </nav>

            {children}
          </div>
        </main>
      </div>

      {showLoggedInHeader ? <Footer /> : <PublicFooter />}
    </div>
  );
}
