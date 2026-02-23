/**
 * Admin Role Detail Page
 * 
 * View and edit role details, manage permissions and members.
 * Role data is fetched from the authz service.
 */

import { redirect } from 'next/navigation';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { RoleForm } from '@/components/admin/RoleForm';
import { PermissionMatrix } from '@/components/admin/PermissionMatrix';
import { Button, StatusBadge, getRole, getRoleResourceBindings, listUsers } from '@jazzmind/busibox-app';
import Link from 'next/link';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getAppConfigStoreContextForUser, listAppsFromStore } from '@jazzmind/busibox-app/lib/deploy/app-config';

export const metadata = {
  title: 'Role Details - Admin Portal',
  description: 'View and edit role information',
};

type PageProps = {
  params: Promise<{ roleId: string }>;
};

export default async function RoleDetailPage({ params }: PageProps) {
  const authResult = await getCurrentUserWithSessionFromCookies();
  
  if (!authResult) {
    redirect('/portal/login');
  }

  const { roles: currentUserRoles, sessionJwt } = authResult;

  if (!currentUserRoles?.includes('Admin')) {
    redirect('/portal/home');
  }

  const { roleId } = await params;
  
  // Get authenticated options for authz calls
  let options;
  try {
    options = await getAuthzOptionsWithToken(sessionJwt);
  } catch (err) {
    console.error('[RoleDetailPage] Failed to get authz token:', err);
    redirect('/roles');
  }

  // Get role details from authz
  const role = await getRole(roleId, options);

  if (!role) {
    redirect('/roles');
  }

  // Get app bindings for this role
  const appBindings = await getRoleResourceBindings(roleId, 'app', options);
  
  // Fetch app details for bindings
  const appIds = appBindings.map(b => b.resource_id);
  const appStoreContext = await getAppConfigStoreContextForUser(authResult.id, sessionJwt);
  const apps = appIds.length > 0
    ? (await listAppsFromStore(appStoreContext.accessToken))
      .filter((app) => appIds.includes(app.id))
      .map((app) => ({ id: app.id, name: app.name, type: app.type }))
    : [];
  const appMap = new Map(apps.map(a => [a.id, a]));
  
  const rolePermissions = appBindings.map(b => ({
    id: b.id,
    app: appMap.get(b.resource_id),
  })).filter(p => p.app);

  // Get users with this role from authz
  const allUsersResponse = await listUsers({}, options);
  const usersWithRole = allUsersResponse.users.filter(u => 
    u.roles.some(r => r.id === roleId)
  ).map(u => ({
    id: u.id,
    email: u.email,
    assignedAt: u.created_at, // Use created_at as a proxy for assignment time
  }));

  const transformedRole = {
    id: role.id,
    name: role.name,
    description: role.description || null,
    isSystem: role.is_system || false,
    scopes: role.scopes || [],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{role.name}</h1>
                {role.is_system && (
                  <StatusBadge status="System" variant="info" />
                )}
              </div>
              {role.description && (
                <p className="text-gray-600">{role.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span>{usersWithRole.length} members</span>
                <span>•</span>
                <span>{rolePermissions.length} app permissions</span>
              </div>
            </div>
            
            <Link href="/roles">
              <Button variant="secondary">
                ← Back to Roles
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Role Details & Edit Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Role Information</h2>
              <RoleForm role={transformedRole} />
            </div>

            {/* App Permissions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">App Permissions</h2>
              <p className="text-gray-600 mb-4">
                Configure which applications this role can access
              </p>
              <PermissionMatrix roleId={roleId} />
            </div>
          </div>

          {/* Sidebar - Members */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Members ({usersWithRole.length})
              </h2>
              {usersWithRole.length > 0 ? (
                <ul className="space-y-3">
                  {usersWithRole.slice(0, 10).map(user => (
                    <li key={user.id} className="pb-3 border-b border-gray-100 last:border-0">
                      <Link
                        href={`/users/${user.id}`}
                        className="block hover:bg-gray-50 rounded p-2 -m-2 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900">{user.email}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Added {new Date(user.assignedAt).toLocaleDateString()}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No members assigned to this role yet</p>
              )}

              {usersWithRole.length > 10 && (
                <p className="text-sm text-gray-500 mt-4">
                  +{usersWithRole.length - 10} more members
                </p>
              )}

              <Link href="/users" className="block mt-4">
                <Button variant="secondary" fullWidth>
                  Manage Users →
                </Button>
              </Link>
            </div>

            {/* Metadata */}
            <div className="bg-white rounded-lg shadow-md p-6 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Metadata</h2>
              <dl className="grid grid-cols-1 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(role.created_at).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(role.updated_at).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {role.is_system ? 'System Role' : 'Custom Role'}
                  </dd>
                </div>
                {role.scopes && role.scopes.length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">OAuth Scopes</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <div className="flex flex-wrap gap-1">
                        {role.scopes.map(scope => (
                          <span key={scope} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {scope}
                          </span>
                        ))}
                      </div>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
