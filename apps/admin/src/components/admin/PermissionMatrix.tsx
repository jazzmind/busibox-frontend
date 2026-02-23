/**
 * PermissionMatrix Component
 * 
 * Grid showing roles vs apps with permission checkboxes.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type App = {
  id: string;
  name: string;
  type: string;
};

type Role = {
  id: string;
  name: string;
  isSystem: boolean;
};

type Permission = {
  roleId: string;
  appId: string;
};

type PermissionMatrixProps = {
  roleId?: string; // If provided, show only this role
  appId?: string;  // If provided, show only this app
};

export function PermissionMatrix({ roleId, appId }: PermissionMatrixProps) {
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null); // roleId-appId combo being updated
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [roleId, appId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch ALL apps (not just user's apps) - admin needs to see all apps
      const appsResponse = await fetch('/api/apps');
      const appsData = await appsResponse.json();
      
      // Fetch roles
      const rolesResponse = await fetch('/api/roles');
      const rolesData = await rolesResponse.json();

      if (appsData.success && rolesData.success) {
        const allApps = appsData.data.apps || [];
        const allRoles = rolesData.data.roles || [];

        // Filter if needed
        setApps(appId ? allApps.filter((a: App) => a.id === appId) : allApps);
        setRoles(roleId ? allRoles.filter((r: Role) => r.id === roleId) : allRoles);

        // Build permissions map
        const perms: Permission[] = [];
        for (const role of allRoles) {
          const roleDetailResponse = await fetch(`/api/roles/${role.id}`);
          const roleDetailData = await roleDetailResponse.json();
          
          if (roleDetailData.success) {
            const roleApps = roleDetailData.data.role.apps || [];
            for (const app of roleApps) {
              perms.push({
                roleId: role.id,
                appId: app.appId,
              });
            }
          }
        }
        setPermissions(perms);
      } else {
        setError('Failed to load data');
      }
    } catch (err) {
      console.error('Failed to fetch permission matrix:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (roleId: string, appId: string): boolean => {
    return permissions.some(p => p.roleId === roleId && p.appId === appId);
  };

  const togglePermission = async (role: Role, app: App) => {
    const updateKey = `${role.id}-${app.id}`;
    setUpdating(updateKey);

    try {
      const hasAccess = hasPermission(role.id, app.id);
      const url = `/api/roles/${role.id}/permissions`;
      const method = hasAccess ? 'DELETE' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: app.id }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        if (hasAccess) {
          setPermissions(prev => prev.filter(p => !(p.roleId === role.id && p.appId === app.id)));
        } else {
          setPermissions(prev => [...prev, { roleId: role.id, appId: app.id }]);
        }
        router.refresh();
      } else {
        alert(data.error || 'Failed to update permission');
      }
    } catch (err) {
      console.error('Failed to toggle permission:', err);
      alert('An unexpected error occurred');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading permissions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (apps.length === 0 || roles.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">
          {apps.length === 0 && roles.length === 0
            ? 'No apps or roles available'
            : apps.length === 0
            ? 'No apps available'
            : 'No roles available'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b border-r border-gray-200">
              App / Role
            </th>
            {roles.map(role => (
              <th
                key={role.id}
                className="px-4 py-3 text-center text-sm font-medium text-gray-700 border-b border-gray-200"
              >
                <div>{role.name}</div>
                {role.isSystem && (
                  <div className="text-xs text-blue-600">System</div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {apps.map(app => (
            <tr key={app.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900 border-b border-r border-gray-200 bg-gray-50">
                <div>{app.name}</div>
                <div className="text-xs text-gray-500 font-normal">{app.type}</div>
              </td>
              {roles.map(role => {
                const updateKey = `${role.id}-${app.id}`;
                const isUpdating = updating === updateKey;
                const checked = hasPermission(role.id, app.id);

                return (
                  <td
                    key={role.id}
                    className="px-4 py-3 text-center border-b border-gray-200"
                  >
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermission(role, app)}
                        disabled={isUpdating}
                        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                      />
                    </label>
                    {isUpdating && (
                      <div className="text-xs text-gray-500 mt-1">Updating...</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 text-sm text-gray-600">
        <p>✓ = Role has permission to access the app</p>
        <p className="mt-1">Click checkboxes to grant or revoke permissions</p>
      </div>
    </div>
  );
}

