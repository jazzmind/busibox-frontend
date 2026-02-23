/**
 * Admin Services Logs Page
 * 
 * Comprehensive log viewer for all services.
 */

import { redirect } from 'next/navigation';
import { getCurrentUserFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { ServiceLogsViewer } from '@/components/admin/ServiceLogsViewer';
import { Button } from '@jazzmind/busibox-app';
import Link from 'next/link';

export const metadata = {
  title: 'Services Logs - Admin Portal',
  description: 'View and monitor logs from all services',
};

export default async function AdminLogsPage() {
  const currentUser = await getCurrentUserFromCookies();
  
  if (!currentUser) {
    redirect('/portal/login');
  }

  if (!currentUser.roles?.includes('Admin')) {
    redirect('/portal/home');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Services Logs</h1>
              <p className="text-gray-600 mt-1">Monitor logs from all services and containers</p>
            </div>
            
            <Link href="/">
              <Button variant="secondary">
                ← Back to Admin
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ServiceLogsViewer />
      </main>
    </div>
  );
}

