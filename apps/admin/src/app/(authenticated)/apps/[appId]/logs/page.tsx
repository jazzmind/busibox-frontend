/**
 * App Logs Page
 * 
 * Full-page logs viewer for built-in applications
 */

import { redirect } from 'next/navigation';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { AppLogsViewer } from '@/components/admin/AppLogsViewer';
import { Button } from '@jazzmind/busibox-app';
import Link from 'next/link';
import { getAppByIdFromStore, getAppConfigStoreContextForUser } from '@jazzmind/busibox-app/lib/deploy/app-config';

export const metadata = {
  title: 'Application Logs - Admin Portal',
  description: 'View application logs',
};

type PageProps = {
  params: Promise<{ appId: string }>;
};

export default async function AppLogsPage({ params }: PageProps) {
  const currentUser = await getCurrentUserWithSessionFromCookies();
  
  if (!currentUser) {
    redirect('/portal/login');
  }

  if (!currentUser.roles?.includes('Admin')) {
    redirect('/portal/home');
  }

  const { appId } = await params;

  // Get app details
  const context = await getAppConfigStoreContextForUser(currentUser.id, currentUser.sessionJwt);
  const app = await getAppByIdFromStore(context.accessToken, appId);

  if (!app) {
    redirect('/apps');
  }

  // Only built-in and library apps have logs
  if (app.type !== 'BUILT_IN' && app.type !== 'LIBRARY') {
    redirect(`/apps/${appId}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/apps" className="hover:text-gray-900">
                  Apps
                </Link>
                <span>/</span>
                <Link href={`/apps/${appId}`} className="hover:text-gray-900">
                  {app.name}
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Logs</span>
              </nav>
              
              <h1 className="text-3xl font-bold text-gray-900">
                {app.name} - Application Logs
              </h1>
            </div>
            
            <Link href={`/apps/${appId}`}>
              <Button variant="secondary">
                ← Back to App
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AppLogsViewer appId={appId} appName={app.name} />
      </main>
    </div>
  );
}

