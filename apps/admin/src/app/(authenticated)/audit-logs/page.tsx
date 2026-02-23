/**
 * Admin Audit Logs Page
 * 
 * View system audit logs with filtering.
 */

import { redirect } from 'next/navigation';
import { getCurrentUserFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { AuditLogTable } from '@/components/admin/AuditLogTable';
import { Button } from '@jazzmind/busibox-app';
import Link from 'next/link';

export const metadata = {
  title: 'Audit Logs - Admin Portal',
  description: 'View system security and user activity logs',
};

type PageProps = {
  searchParams: Promise<{ userId?: string }>;
};

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const currentUser = await getCurrentUserFromCookies();
  
  if (!currentUser) {
    redirect('/portal/login');
  }

  if (!currentUser.roles?.includes('Admin')) {
    redirect('/portal/home');
  }

  const params = await searchParams;
  const userId = params.userId;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
              <p className="text-gray-600 mt-1">
                {userId 
                  ? 'Viewing activity for specific user' 
                  : 'System-wide security and activity logs'}
              </p>
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
        <AuditLogTable userId={userId} />
      </main>
    </div>
  );
}

