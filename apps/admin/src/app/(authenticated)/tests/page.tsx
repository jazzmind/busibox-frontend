/**
 * Admin Tests Page
 * 
 * Run interactive admin/system test harnesses and monitor test execution.
 */

'use client';

import Link from 'next/link';
import { QuickActions } from '@/components/admin/tests/QuickActions';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { useCustomization } from '@jazzmind/busibox-app';
import { Play, History, Shield } from 'lucide-react';

export default function AdminTestsPage() {
  const { user } = useSession();
  const { customization } = useCustomization();

  // Check if user is admin
  if (!user) {
    window.location.href = '/portal/login';
    return null;
  }

  if (!user.roles?.includes('Admin')) {
    window.location.href = '/portal/home';
    return null;
  }

  const testPages = [
    {
      title: 'Test Runner',
      description: 'Run and monitor all unit, integration, and security tests across all projects and services.',
      href: '/tests/runner',
      icon: <Play className="w-5 h-5" />,
    },
    {
      title: 'Test History',
      description: 'View past test execution results, statistics, and trends across all test suites.',
      href: '/tests/history',
      icon: <History className="w-5 h-5" />,
    },
    {
      title: 'Permissions & RAG',
      description: 'Toggle test roles, seed docs (text + visual), and verify access/RAG.',
      href: '/tests/permissions',
      icon: <Shield className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-full bg-white">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Admin Tests</h1>
            <p className="text-gray-600 mt-1">
              Run interactive admin/system test harnesses and monitor test execution
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <QuickActions />
        </div>

        {/* Test Pages */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Suites</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testPages.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="block border border-gray-200 rounded-xl hover:shadow-md transition-all bg-white group"
                style={{ 
                  ['--hover-border-color' as any]: `${customization.primaryColor}50`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${customization.primaryColor}50`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '';
                }}
              >
                <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ 
                      backgroundColor: `${customization.primaryColor}15`,
                      color: customization.primaryColor,
                    }}
                  >
                    {t.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{t.title}</h3>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-600">{t.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
