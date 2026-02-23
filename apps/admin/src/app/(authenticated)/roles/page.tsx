/**
 * Admin Roles Management Page
 * 
 * Manage all roles in the system with permission matrix.
 */

'use client';

import Link from 'next/link';
import { RoleList } from '@/components/admin/RoleList';
import { PermissionMatrix } from '@/components/admin/PermissionMatrix';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { useCustomization } from '@jazzmind/busibox-app';
import { Plus } from 'lucide-react';

export default function AdminRolesPage() {
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
    <div className="min-h-full bg-white">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Role Management</h1>
              <p className="text-gray-600 mt-1">Manage roles, assign permissions, and control access</p>
            </div>
            
            <Link
              href="/roles/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium"
              style={{ backgroundColor: customization.primaryColor }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <Plus className="w-4 h-4" />
              Create Role
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Roles List */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Roles</h2>
          <RoleList />
        </div>

        {/* Permission Matrix */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Permission Matrix</h2>
          <p className="text-gray-600 mb-4 text-sm">
            Quick overview of which roles have access to which applications
          </p>
          <PermissionMatrix />
        </div>
      </main>
    </div>
  );
}
