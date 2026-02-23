/**
 * Admin New App Page
 * 
 * Register a new application.
 */

import { redirect } from 'next/navigation';
import { getCurrentUserFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { AppForm } from '@/components/admin/AppForm';
import { Button } from '@jazzmind/busibox-app';
import Link from 'next/link';

export const metadata = {
  title: 'Register App - Admin Portal',
  description: 'Register a new application',
};

export default async function NewAppPage() {
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Register New App</h1>
              <p className="text-gray-600 mt-1">Add a new application to the portal</p>
            </div>
            
            <Link href="/apps">
              <Button variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <AppForm />
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            App Types:
          </h3>
          <ul className="text-sm text-blue-700 space-y-2">
            <li>
              <strong>Library App:</strong> Pre-configured apps (Doc Intel, Data Visualizer, etc.) 
              deployed alongside Busibox Portal on separate ports via nginx proxy.
            </li>
            <li>
              <strong>External App (GitHub):</strong> Deploy any Busibox-compatible app from GitHub. 
              The system will read the busibox.json manifest, provision the database, and deploy automatically.
            </li>
          </ul>
          
          <div className="mt-4 bg-white border border-blue-200 rounded p-3">
            <p className="text-sm font-medium text-blue-900 mb-1">Requirements for GitHub Apps:</p>
            <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
              <li>Must include a <code className="bg-blue-100 px-1 rounded">busibox.json</code> manifest</li>
              <li>Must use <code className="bg-blue-100 px-1 rounded">@jazzmind/busibox-app</code> for SSO auth</li>
              <li>Database will be automatically provisioned if required</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

