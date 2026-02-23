/**
 * Admin User Detail Page
 * 
 * View and edit user details.
 * User data is fetched from the authz service.
 */

import { redirect } from 'next/navigation';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { UserForm } from '@/components/admin/UserForm';
import { RoleManager } from '@/components/admin/RoleManager';
import { DeleteUserButton } from '@/components/admin/DeleteUserButton';
import { Button, StatusBadge, getUser } from '@jazzmind/busibox-app';
import Link from 'next/link';
import type { UserStatus } from '@/types';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';

export const metadata = {
  title: 'User Details - Admin Portal',
  description: 'View and edit user information',
};

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default async function UserDetailPage({ params }: PageProps) {
  const authResult = await getCurrentUserWithSessionFromCookies();
  
  if (!authResult) {
    redirect('/portal/login');
  }

  const { roles: currentUserRoles, sessionJwt } = authResult;

  if (!currentUserRoles?.includes('Admin')) {
    redirect('/portal/home');
  }

  const { userId } = await params;
  
  // Get authenticated options for authz calls
  let rbacOptions;
  try {
    rbacOptions = await getAuthzOptionsWithToken(sessionJwt);
  } catch (err) {
    console.error('[UserDetailPage] Failed to get authz token:', err);
    redirect('/users');
  }

  // Get user details from authz service
  const user = await getUser(userId, rbacOptions);

  if (!user) {
    redirect('/users');
  }

  // TODO: Add listAuditLogs to busibox-app to enable recent activity display
  const recentActivity: { id: string; eventType: string; action: string; success: boolean; createdAt: string }[] = [];

  const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'DEACTIVATED':
        return 'danger';
      default:
        return 'warning';
    }
  };

  const transformedUser = {
    id: user.id,
    email: user.email,
    status: (user.status || 'ACTIVE') as UserStatus,
    displayName: user.display_name || '',
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    avatarUrl: user.avatar_url || '',
    roles: user.roles.map(role => ({
      id: role.id,
      name: role.name,
    })),
  };

  const transformedRoles = user.roles.map(role => ({
    id: role.id,
    name: role.name,
    assignedAt: new Date(), // Role assignment date not available from authz response
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {user.display_name || user.email}
              </h1>
              {user.display_name && (
                <p className="text-sm text-gray-500">{user.email}</p>
              )}
              <div className="flex items-center gap-4 mt-2">
                <StatusBadge status={user.status || 'ACTIVE'} variant={getStatusVariant(user.status || 'ACTIVE')} />
                {user.last_login_at && (
                  <span className="text-sm text-gray-600">
                    Last login: {new Date(user.last_login_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            
            <Link href="/users">
              <Button variant="secondary">
                ← Back to Users
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Details & Edit Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">User Information</h2>
              <UserForm user={transformedUser} />
            </div>

            {/* User Metadata */}
            <div className="bg-white rounded-lg shadow-md p-6 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Metadata</h2>
              <dl className="grid grid-cols-1 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(user.created_at).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(user.updated_at).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email Verified</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {user.email_verified_at ? new Date(user.email_verified_at).toLocaleString() : 'Not verified'}
                  </dd>
                </div>
                {user.pending_expires_at && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Pending Expires</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(user.pending_expires_at).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-lg shadow-md p-6 mt-6 border-2 border-red-200">
              <h2 className="text-xl font-semibold text-red-900 mb-2">Danger Zone</h2>
              <p className="text-sm text-gray-600 mb-4">
                Deleting a user will deactivate their account and invalidate all sessions. This action cannot be undone.
              </p>
              <DeleteUserButton userId={user.id} userEmail={user.email} />
            </div>
          </div>

          {/* Sidebar - Roles & Recent Activity */}
          <div className="lg:col-span-1 space-y-6">
            {/* Roles */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <RoleManager
                userId={user.id}
                userRoles={transformedRoles}
              />
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
              {recentActivity.length > 0 ? (
                <ul className="space-y-3">
                  {recentActivity.map(log => (
                    <li key={log.id} className="pb-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{log.action}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(log.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <StatusBadge
                          status={log.success ? '✓' : '✗'}
                          variant={log.success ? 'success' : 'danger'}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No recent activity</p>
              )}
              
              <Link href={`/audit-logs?userId=${userId}`} className="block mt-4">
                <Button variant="secondary" fullWidth>
                  View All Activity →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
