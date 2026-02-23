/**
 * Admin New User Page
 * 
 * Create a new user.
 * Role data is fetched from the authz service.
 */

import { redirect } from 'next/navigation';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { UserForm } from '@/components/admin/UserForm';
import { Button, listRoles } from '@jazzmind/busibox-app';
import Link from 'next/link';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';

export const metadata = {
  title: 'Create User - Admin Portal',
  description: 'Create a new user account',
};

export default async function NewUserPage() {
  const authResult = await getCurrentUserWithSessionFromCookies();
  
  if (!authResult) {
    redirect('/portal/login');
  }

  const { roles: userRoles, sessionJwt } = authResult;

  if (!userRoles?.includes('Admin')) {
    redirect('/portal/home');
  }

  // Get available roles from authz with authenticated token
  let roles: { id: string; name: string }[] = [];
  let error: string | null = null;
  
  try {
    const options = await getAuthzOptionsWithToken(sessionJwt);
    const authzRoles = await listRoles(options);
    
    roles = authzRoles.map(r => ({
      id: r.id,
      name: r.name,
    })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('[NewUserPage] Failed to fetch roles:', err);
    error = 'Failed to load roles. Please try again later.';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create New User</h1>
              <p className="text-gray-600 mt-1">Add a new user to the system</p>
            </div>
            
            <Link href="/users">
              <Button variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Link href="/users">
              <Button variant="secondary">
                ← Back to Users
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <UserForm availableRoles={roles} />
          </div>
        )}
      </main>
    </div>
  );
}
