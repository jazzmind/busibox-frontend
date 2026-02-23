/**
 * Admin Apps List Page
 * 
 * Manage all applications in the system.
 */

'use client';

import Link from 'next/link';
import { AppListWithBrowser } from '@/components/admin/AppListWithBrowser';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { useCustomization } from '@jazzmind/busibox-app';
import { Plus } from 'lucide-react';

export default function AdminAppsPage() {
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

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Page Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">App Management</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Register and manage applications with OAuth SSO</p>
            </div>
            
            <Link
              href="/apps/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium hover:opacity-90"
              style={{ backgroundColor: customization.primaryColor }}
            >
              <Plus className="w-4 h-4" />
              Add App
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <AppListWithBrowser />
        </div>
      </main>
    </div>
  );
}
