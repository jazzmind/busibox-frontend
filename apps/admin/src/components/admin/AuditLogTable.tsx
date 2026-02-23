/**
 * AuditLogTable Component
 * 
 * Displays audit logs with filtering and pagination.
 * Audit logs are now fetched from the authz service.
 */

'use client';

import { useEffect, useState } from 'react';
import { Table, StatusBadge, Pagination, Button } from '@jazzmind/busibox-app';
import type { AuditEventType } from '@jazzmind/busibox-app/lib/authz/audit';

type AuditLogEntry = {
  id: string;
  eventType: AuditEventType | string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  details: Record<string, any> | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
};

type AuditLogTableProps = {
  userId?: string;
  initialPage?: number;
};

export function AuditLogTable({ userId, initialPage = 1 }: AuditLogTableProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [successFilter, setSuccessFilter] = useState<string>('');
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [page, userId, eventTypeFilter, successFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });

      if (userId) params.append('userId', userId);
      if (eventTypeFilter) params.append('eventType', eventTypeFilter);
      if (successFilter) params.append('success', successFilter);

      const response = await fetch(`/api/audit-logs?${params}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data.logs);
        setTotalPages(data.data.pagination.totalPages);
      } else {
        setError(data.error || 'Failed to load audit logs');
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const eventTypeOptions = [
    'USER_LOGIN',
    'USER_LOGIN_FAILED',
    'USER_LOGOUT',
    'MAGIC_LINK_SENT',
    'MAGIC_LINK_USED',
    'MAGIC_LINK_EXPIRED',
    'USER_CREATED',
    'USER_ACTIVATED',
    'USER_DEACTIVATED',
    'USER_REACTIVATED',
    'ROLE_ASSIGNED',
    'ROLE_REMOVED',
    'ACCESS_DENIED',
    'SESSION_EXPIRED',
  ];

  const columns = [
    {
      key: 'createdAt',
      label: 'Timestamp',
      width: '180px',
      render: (log: AuditLogEntry) => (
        <div className="text-xs">
          <div className="font-medium text-gray-900">
            {new Date(log.createdAt).toLocaleDateString()}
          </div>
          <div className="text-gray-500">
            {new Date(log.createdAt).toLocaleTimeString()}
          </div>
        </div>
      ),
    },
    {
      key: 'eventType',
      label: 'Event',
      width: '200px',
      render: (log: AuditLogEntry) => (
        <div>
          <div className="text-xs font-mono text-gray-700">{log.eventType}</div>
          {log.userEmail && (
            <div className="text-xs text-gray-500 mt-1">{log.userEmail}</div>
          )}
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (log: AuditLogEntry) => (
        <div className="text-sm text-gray-700">{log.action}</div>
      ),
    },
    {
      key: 'success',
      label: 'Status',
      width: '100px',
      render: (log: AuditLogEntry) => (
        <StatusBadge
          status={log.success ? 'Success' : 'Failed'}
          variant={log.success ? 'success' : 'danger'}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div className="w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Type
          </label>
          <select
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="">All event types</option>
            {eventTypeOptions.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={successFilter}
            onChange={(e) => {
              setSuccessFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All statuses</option>
            <option value="true">Success</option>
            <option value="false">Failed</option>
          </select>
        </div>

        <Button
          variant="secondary"
          onClick={() => {
            setEventTypeFilter('');
            setSuccessFilter('');
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
          <Button variant="secondary" onClick={fetchLogs} className="mt-2">
            Try Again
          </Button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table
              columns={columns}
              data={logs}
              keyExtractor={(log) => log.id}
              loading={loading}
              emptyMessage="No audit logs found"
            />
          </div>

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
