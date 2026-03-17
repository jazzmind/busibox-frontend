'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Role = {
  id: string;
  name: string;
  isSystem: boolean;
};

interface AppRoleManagerProps {
  appId: string;
  initialRoleIds: string[];
}

export function AppRoleManager({ appId, initialRoleIds }: AppRoleManagerProps) {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [grantedRoleIds, setGrantedRoleIds] = useState<Set<string>>(new Set(initialRoleIds));
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/roles');
      const data = await response.json();
      if (data.success) {
        setRoles(data.data.roles || []);
      } else {
        setError('Failed to load roles');
      }
    } catch {
      setError('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

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

  const grantedCount = roles.filter((r) => grantedRoleIds.has(r.id)).length;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Roles with Access ({grantedCount})
      </h2>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {roles.length === 0 ? (
        <p className="text-sm text-gray-500">No roles available</p>
      ) : (
        <ul className="space-y-1">
          {roles.map((role) => {
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
        Toggle roles to grant or revoke access to this app.
      </p>
    </div>
  );
}
