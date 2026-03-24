'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Role = {
  id: string;
  name: string;
  isSystem: boolean;
  source_app?: string;
};

interface AppRoleManagerProps {
  appId: string;
  appAudience: string;
  initialRoleIds: string[];
}

const isAppRole = (role: Role) =>
  role.name.startsWith('app:') || !!role.source_app;

export function AppRoleManager({ appId, appAudience, initialRoleIds }: AppRoleManagerProps) {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [grantedRoleIds, setGrantedRoleIds] = useState<Set<string>>(new Set(initialRoleIds));
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [appRole, setAppRole] = useState<Role | null>(null);
  const [creatingAppRole, setCreatingAppRole] = useState(false);

  const expectedAppRoleName = `app:${appAudience}`;

  const fetchRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/roles');
      const data = await response.json();
      if (data.success) {
        const allRoles: Role[] = data.data.roles || [];
        setRoles(allRoles);

        const existing = allRoles.find((r) => r.name === expectedAppRoleName);
        if (existing) {
          setAppRole(existing);
        }
      } else {
        setError('Failed to load roles');
      }
    } catch {
      setError('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [expectedAppRoleName]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const createAppRole = async () => {
    setCreatingAppRole(true);
    setError('');
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: expectedAppRoleName,
          description: `App role for ${appAudience}`,
          scopes: ['data:read', 'data:write'],
        }),
      });
      const data = await response.json();
      if (data.success && data.data?.role) {
        const newRole: Role = {
          id: data.data.role.id,
          name: data.data.role.name,
          isSystem: false,
        };
        setAppRole(newRole);
        setRoles((prev) => [...prev, newRole]);

        // Auto-grant the new app role access to this app
        await toggleRole(newRole);
      } else {
        setError(data.error || 'Failed to create app role');
      }
    } catch {
      setError('Failed to create app role');
    } finally {
      setCreatingAppRole(false);
    }
  };

  const toggleRole = async (role: Role) => {
    setUpdating(role.id);
    setError('');

    const hasAccess = grantedRoleIds.has(role.id);
    const method = hasAccess ? 'DELETE' : 'POST';

    try {
      const response = await fetch(`/api/roles/${role.id}/permissions`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      });

      const data = await response.json();
      if (data.success) {
        setGrantedRoleIds((prev) => {
          const next = new Set(prev);
          if (hasAccess) {
            next.delete(role.id);
          } else {
            next.add(role.id);
          }
          return next;
        });
        router.refresh();
      } else {
        if (data.error === 'Permission already granted') {
          setGrantedRoleIds((prev) => new Set([...prev, role.id]));
        } else {
          setError(data.error || 'Failed to update permission');
        }
      }
    } catch {
      setError('Failed to update permission');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  const orgRoles = roles.filter((r) => !isAppRole(r));
  const grantedOrgCount = orgRoles.filter((r) => grantedRoleIds.has(r.id)).length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* App Role Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">App Role</h2>
        {appRole ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-3 py-1.5 text-sm font-medium border border-indigo-200">
              {appRole.name}
            </span>
            {grantedRoleIds.has(appRole.id) ? (
              <span className="text-xs text-green-600">✓ Granted</span>
            ) : (
              <button
                type="button"
                onClick={() => toggleRole(appRole)}
                disabled={updating === appRole.id}
                className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
              >
                Grant access
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 font-mono">{expectedAppRoleName}</span>
            <button
              type="button"
              onClick={createAppRole}
              disabled={creatingAppRole}
              className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {creatingAppRole ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        )}
        <p className="mt-1.5 text-xs text-gray-500">
          This role is automatically assigned to users who launch this app.
        </p>
      </div>

      {/* Org/User Roles Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Roles with App Access ({grantedOrgCount})
        </h2>

        {orgRoles.length === 0 ? (
          <p className="text-sm text-gray-500">No organization roles available</p>
        ) : (
          <ul className="space-y-1">
            {orgRoles.map((role) => {
              const isGranted = grantedRoleIds.has(role.id);
              const isUpdating = updating === role.id;

              return (
                <li key={role.id}>
                  <label
                    className={`flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors ${
                      isGranted
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    } ${isUpdating ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isGranted}
                      onChange={() => toggleRole(role)}
                      disabled={isUpdating}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{role.name}</span>
                      {role.isSystem && (
                        <span className="ml-2 text-xs text-blue-600">System</span>
                      )}
                    </div>
                    {isUpdating && (
                      <svg className="animate-spin h-4 w-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-xs text-gray-500">
          Organization roles that grant access to this app. Users with any checked role can launch the app.
        </p>
      </div>
    </div>
  );
}
