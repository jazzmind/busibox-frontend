/**
 * Admin Users Management Page
 * 
 * Page for managing users with tabs for Users and Roles views.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserList } from '@/components/admin/UserList';
import { RoleList } from '@/components/admin/RoleList';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { useCustomization } from '@jazzmind/busibox-app';
import { Users, Shield, Plus } from 'lucide-react';

type Tab = 'users' | 'roles';

export default function AdminUsersPage() {
  const { user } = useSession();
  const { customization } = useCustomization();
  const [activeTab, setActiveTab] = useState<Tab>('users');

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
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Page Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">User Management</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage users, roles, and permissions</p>
            </div>
            
            <div className="flex gap-3">
              {activeTab === 'users' && (
                <Link
                  href="/users/new"
                  className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium hover:opacity-90"
                  style={{ backgroundColor: customization.primaryColor }}
                >
                  <Plus className="w-4 h-4" />
                  Add User
                </Link>
              )}
              
              {activeTab === 'roles' && (
                <Link
                  href="/roles/new"
                  className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium hover:opacity-90"
                  style={{ backgroundColor: customization.primaryColor }}
                >
                  <Plus className="w-4 h-4" />
                  Add Role
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'users'
                  ? 'border-current'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              style={activeTab === 'users' ? { color: customization.primaryColor, borderColor: customization.primaryColor } : undefined}
            >
              <Users className="w-4 h-4" />
              Users
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'roles'
                  ? 'border-current'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              style={activeTab === 'roles' ? { color: customization.primaryColor, borderColor: customization.primaryColor } : undefined}
            >
              <Shield className="w-4 h-4" />
              Roles
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {activeTab === 'users' && <UserList />}
          {activeTab === 'roles' && <RoleList />}
        </div>
      </main>
    </div>
  );
}
