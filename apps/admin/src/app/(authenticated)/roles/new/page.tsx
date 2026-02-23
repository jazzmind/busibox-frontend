/**
 * Admin New Role Page
 * 
 * Create a new role.
 */

import { redirect } from 'next/navigation';
import { getCurrentUserFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { RoleForm } from '@/components/admin/RoleForm';
import { Button } from '@jazzmind/busibox-app';
import Link from 'next/link';

export const metadata = {
  title: 'Create Role - Admin Portal',
  description: 'Create a new role',
};

export default async function NewRolePage() {
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
              <h1 className="text-3xl font-bold text-gray-900">Create New Role</h1>
              <p className="text-gray-600 mt-1">Add a new role to the system</p>
            </div>
            
            <Link href="/roles">
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
          <RoleForm />
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Tips</h3>
          <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
            <li>Create the role with a descriptive name</li>
            <li>Select OAuth scopes to control backend service access (click &quot;Edit Scopes&quot;)</li>
            <li>After creation, assign app permissions from the role detail page</li>
            <li>Assign users to this role from the Users page</li>
          </ol>
        </div>
      </main>
    </div>
  );
}

