/**
 * UserList Component
 * 
 * Displays list of users with filtering, search, and pagination.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, StatusBadge, Pagination, Input, Button } from '@jazzmind/busibox-app';
import type { UserStatus } from '@/types';

type UserListItem = {
  id: string;
  email: string;
  status: UserStatus;
  roles: { id: string; name: string; assignedAt: Date }[];
  lastLoginAt: Date | null;
  createdAt: Date;
};

type UserListProps = {
  initialPage?: number;
};

export function UserList({ initialPage = 1 }: UserListProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchUsers();
  }, [page, search, statusFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(`/api/users?${params}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.data.users);
        setTotalPages(data.data.pagination.totalPages);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (user: UserListItem) => {
    router.push(`/users/${user.id}`);
  };

  const getStatusVariant = (status: UserStatus): 'success' | 'warning' | 'danger' => {
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

  const columns = [
    {
      key: 'email',
      label: 'Email',
      render: (user: UserListItem) => (
        <div>
          <div className="font-medium text-gray-900">{user.email}</div>
          <div className="text-xs text-gray-500">
            {user.roles.length > 0 ? user.roles.map(r => r.name).join(', ') : 'No roles'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (user: UserListItem) => (
        <StatusBadge status={user.status} variant={getStatusVariant(user.status)} />
      ),
    },
    {
      key: 'lastLoginAt',
      label: 'Last Login',
      render: (user: UserListItem) => (
        <span className="text-sm text-gray-700">
          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (user: UserListItem) => (
        <span className="text-sm text-gray-700">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <Input
            label="Search by email"
            placeholder="user@example.com"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>

        <Button
          variant="secondary"
          onClick={() => {
            setSearch('');
            setStatusFilter('');
            setPage(1);
          }}
        >
          Clear Filters
        </Button>
      </div>

      {/* Table */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">{error}</p>
          <Button variant="secondary" onClick={fetchUsers} className="mt-2">
            Try Again
          </Button>
        </div>
      ) : (
        <>
          <Table
            columns={columns}
            data={users}
            keyExtractor={(user) => user.id}
            onRowClick={handleRowClick}
            loading={loading}
            emptyMessage="No users found"
          />

          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

