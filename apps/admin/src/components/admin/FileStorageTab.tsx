'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  HardDrive,
  Loader2,
  RefreshCw,
  Search,
  FileText,
  ExternalLink,
} from 'lucide-react';

export type StorageStatsSummary = {
  totalSize: number;
  usedSize: number;
  fileCount: number;
  bucketCount: number;
};

type AdminFile = {
  id: string;
  name: string;
  originalFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  visibility?: string | null;
  libraryId?: string | null;
  ownerId?: string | null;
  chunkCount?: number | null;
  vectorCount?: number | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

const PAGE_SIZE = 50;

export function FileStorageTab({ storageStats }: { storageStats: StorageStatsSummary | null }) {
  const [files, setFiles] = useState<AdminFile[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'size'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/data/admin/files?${params.toString()}`);
      if (!res.ok) {
        setError(`Request failed: ${res.status}`);
        return;
      }
      const result = await res.json();
      const data = result.success ? result.data : result;
      setFiles(data.files || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('FileStorageTab fetch error:', err);
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, sortBy, sortOrder]);

  // Debounce search input before firing a fetch.
  useEffect(() => {
    const handle = setTimeout(() => {
      setOffset(0);
      fetchFiles();
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summaryCards = useMemo(
    () => [
      {
        label: 'Used Storage',
        value: storageStats ? formatBytes(storageStats.usedSize) : '--',
      },
      {
        label: 'Total Storage',
        value: storageStats ? formatBytes(storageStats.totalSize) : '--',
      },
      {
        label: 'Files (MinIO)',
        value: storageStats ? formatNumber(storageStats.fileCount) : '--',
      },
      {
        label: 'Buckets',
        value: storageStats ? formatNumber(storageStats.bucketCount) : '--',
      },
    ],
    [storageStats],
  );

  const toggleSort = (field: 'createdAt' | 'name' | 'size') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setOffset(0);
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {summaryCards.map(card => (
          <div
            key={card.label}
            className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3"
          >
            <div className="p-2 bg-cyan-50 rounded-lg">
              <HardDrive className="w-4 h-4 text-cyan-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-lg font-semibold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {storageStats && storageStats.totalSize > 0 && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500">Usage</span>
            <span className="font-medium text-gray-700">
              {Math.round((storageStats.usedSize / storageStats.totalSize) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${(storageStats.usedSize / storageStats.totalSize) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-500">
            {formatNumber(total)} file{total === 1 ? '' : 's'}
          </p>
          <button
            onClick={() => fetchFiles()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-gray-700"
                  >
                    Filename{sortBy === 'name' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => toggleSort('size')}
                    className="inline-flex items-center gap-1 hover:text-gray-700"
                  >
                    Size{sortBy === 'size' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visibility
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Library
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => toggleSort('createdAt')}
                    className="inline-flex items-center gap-1 hover:text-gray-700"
                  >
                    Uploaded{sortBy === 'createdAt' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium text-gray-900 truncate max-w-[260px]"
                          title={file.originalFilename || file.name}
                        >
                          {file.originalFilename || file.name}
                        </p>
                        {file.originalFilename && file.originalFilename !== file.name && (
                          <p className="text-xs text-gray-400 truncate max-w-[260px]">
                            {file.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {file.mimeType || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {formatBytes(file.sizeBytes)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        file.visibility === 'personal'
                          ? 'bg-yellow-100 text-yellow-800'
                          : file.visibility === 'shared'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {file.visibility || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {file.libraryId ? (
                      <Link
                        href={`/libraries/${file.libraryId}?tab=user-libraries`}
                        className="text-xs text-purple-600 font-mono hover:underline"
                      >
                        {file.libraryId.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500 font-mono">
                      {file.ownerId ? `${file.ownerId.slice(0, 8)}…` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {file.status || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {file.createdAt
                      ? new Date(file.createdAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {file.libraryId && (
                      <Link
                        href={`/libraries/${file.libraryId}?tab=user-libraries`}
                        className="inline-flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-700"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {files.length === 0 && !loading && (
            <div className="text-center py-12">
              <HardDrive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No files found</p>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || loading}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total || loading}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
