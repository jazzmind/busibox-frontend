/**
 * RoleList Component
 * 
 * Displays list of roles with member and app counts.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, StatusBadge, Button } from '@jazzmind/busibox-app';

type RoleListItem = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  memberCount: number;
  appCount: number;
  createdAt: Date;
};

export function RoleList() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/roles');
      const data = await response.json();

      if (data.success) {
        const nonAppRoles = data.data.roles.filter(
          (role: RoleListItem) => !role.name.startsWith('app:')
        );
        setRoles(nonAppRoles);
      } else {
        setError(data.error || 'Failed to load roles');
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (role: RoleListItem) => {
    router.push(`/roles/${role.id}`);
  };

  const columns = [
    {
      key: 'name',
      label: 'Role Name',
      render: (role: RoleListItem) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{role.name}</span>
            {role.isSystem && (
              <StatusBadge status="System" variant="info" />
            )}
          </div>
          {role.description && (
            <div className="text-sm text-gray-500 mt-1">{role.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'memberCount',
      label: 'Members',
      width: '120px',
      render: (role: RoleListItem) => (
        <span className="text-sm text-gray-700">
          {role.memberCount} {role.memberCount === 1 ? 'user' : 'users'}
        </span>
      ),
    },
    {
      key: 'appCount',
      label: 'Apps',
      width: '120px',
      render: (role: RoleListItem) => (
        <span className="text-sm text-gray-700">
          {role.appCount} {role.appCount === 1 ? 'app' : 'apps'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: '150px',
      render: (role: RoleListItem) => (
        <span className="text-sm text-gray-700">
          {new Date(role.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">{error}</p>
          <Button variant="secondary" onClick={fetchRoles} className="mt-2">
            Try Again
          </Button>
        </div>
      ) : (
        <Table
          columns={columns}
          data={roles}
          keyExtractor={(role) => role.id}
          onRowClick={handleRowClick}
          loading={loading}
          emptyMessage="No roles found"
        />
      )}
    </div>
  );
}

