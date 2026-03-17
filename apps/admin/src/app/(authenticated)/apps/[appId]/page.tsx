/**
 * Admin App Detail Page
 * 
 * View and edit app details, manage permissions.
 * Role information is fetched from the authz service.
 */

import { redirect } from 'next/navigation';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { AppForm } from '@/components/admin/AppForm';
import { DeleteAppButton } from '@/components/admin/DeleteAppButton';
import { Button, StatusBadge, getResourceRoles } from '@jazzmind/busibox-app';
import Link from 'next/link';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { ArrowLeft } from 'lucide-react';
import { getAppConfigById } from '@jazzmind/busibox-app/lib/deploy/app-config';
import { AppRoleManager } from '@/components/admin/AppRoleManager';

export const metadata = {
  title: 'App Details - Admin Portal',
  description: 'View and edit application information',
};

type PageProps = {
  params: Promise<{ appId: string }>;
};

export default async function AppDetailPage({ params }: PageProps) {
  const authResult = await getCurrentUserWithSessionFromCookies();
  
  if (!authResult) {
    redirect('/portal/login');
  }

  const { roles: currentUserRoles, sessionJwt } = authResult;

  if (!currentUserRoles?.includes('Admin')) {
    redirect('/portal/home');
  }

  const { appId } = await params;

  const app = await getAppConfigById({ userId: authResult.id, sessionJwt }, appId);

  if (!app) {
    redirect('/apps');
  }

  // Fetch roles that have access to this app from authz bindings
  let rolePermissionsWithNames: { id: string; roleId: string; role: { id: string; name: string } }[] = [];
  try {
    const options = await getAuthzOptionsWithToken(sessionJwt);
    const roleBindings = await getResourceRoles('app', appId, options);
    rolePermissionsWithNames = roleBindings.map(rb => ({
      id: rb.binding_id,
      roleId: rb.id,
      role: {
        id: rb.id,
        name: rb.name,
      },
    }));
  } catch (error) {
    console.error('Failed to fetch app roles from authz:', error);
    // Continue with empty permissions
  }

  // Parse last deployment logs if available
  let lastDeploymentLogs: string[] = [];
  try {
    if (app.lastDeploymentLogs) {
      lastDeploymentLogs = JSON.parse(app.lastDeploymentLogs);
    }
  } catch {
    // If parsing fails, treat as single log entry
    if (app.lastDeploymentLogs) {
      lastDeploymentLogs = [app.lastDeploymentLogs];
    }
  }

  const transformedApp = {
    id: app.id,
    name: app.name,
    description: app.description,
    type: app.type,
    url: app.url,
    iconUrl: app.iconUrl,
    selectedIcon: app.selectedIcon as import('@jazzmind/busibox-app/lib/icons').IconName | null,
    displayOrder: app.displayOrder,
    isActive: app.isActive,
    healthEndpoint: app.healthEndpoint,
    deployedPath: app.deployedPath,
    // Don't pass actual token to client - just indicate if one exists
    hasGithubToken: !!app.githubToken,
    // Deployment info for persistence
    lastDeployment: app.lastDeploymentId ? {
      id: app.lastDeploymentId,
      status: app.lastDeploymentStatus,
      logs: lastDeploymentLogs,
      error: app.lastDeploymentError,
      startedAt: app.lastDeploymentStartedAt?.toISOString(),
      endedAt: app.lastDeploymentEndedAt?.toISOString(),
    } : undefined,
    // Version tracking
    deployedVersion: app.deployedVersion,
    latestVersion: app.latestVersion,
    updateAvailable: app.updateAvailable,
    devMode: app.devMode,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{app.name}</h1>
                <StatusBadge 
                  status={app.type === 'BUILT_IN' ? 'Built-in' : app.type === 'LIBRARY' ? 'Library' : 'External'} 
                  variant={app.type === 'EXTERNAL' ? 'info' : app.type === 'LIBRARY' ? 'warning' : 'success'} 
                />
                {!app.isActive && (
                  <StatusBadge status="Inactive" variant="danger" />
                )}
              </div>
              {app.description && (
                <p className="text-gray-600">{app.description}</p>
              )}
              {app.url && (
                <div className="mt-2 text-sm">
                  <a 
                    href={app.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {app.url}
                  </a>
                </div>
              )}
            </div>
            
            <Link href="/apps">
              <Button variant="secondary"  className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Apps</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* App Details & Edit Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">App Information</h2>
              <AppForm app={transformedApp} />
            </div>

            {/* Quick Actions */}
            {(app.type === 'LIBRARY' || app.type === 'BUILT_IN') && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="flex gap-3">
                  <Link href={`/apps/${appId}/logs`}>
                    <Button variant="secondary">
                      📋 View Logs
                    </Button>
                  </Link>
                </div>
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>📦 Deployment:</strong> This app is deployed using the Busibox deployment manager. 
                    Use the Ansible playbooks to deploy or update this application.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - OAuth & Metadata */}
          <div className="lg:col-span-1 space-y-6">
            {/* Roles with Access */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <AppRoleManager
                appId={appId}
                initialRoleIds={rolePermissionsWithNames.map(rp => rp.roleId)}
              />
            </div>

            {/* Metadata */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Metadata</h2>
              <dl className="grid grid-cols-1 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(app.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(app.updatedAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{app.type}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Display Order</dt>
                  <dd className="mt-1 text-sm text-gray-900">{app.displayOrder}</dd>
                </div>
              </dl>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
              <h2 className="text-xl font-semibold text-red-900 mb-2">Danger Zone</h2>
              <p className="text-sm text-gray-600 mb-4">
                Once you delete an app, there is no going back. Please be certain.
              </p>
              <DeleteAppButton appId={appId} appName={app.name} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
