'use client';

import { useEffect, useState } from 'react';
import { Database, Layers, RefreshCw, HardDrive } from 'lucide-react';

type DatabaseStats = {
  totalRecords?: number;
  tableCount?: number;
  vectorCount?: number;
  indexSize?: number;
  collections?: Array<{
    name: string;
    entityCount?: number;
    indexType?: string;
    metric?: string;
  }>;
};

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return '--';
  return new Intl.NumberFormat().format(num);
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function VectorDbPanel() {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/database/stats');
      if (!res.ok) {
        setError(`Request failed: ${res.status}`);
        return;
      }
      const result = await res.json();
      setStats(result.success ? result.data : result);
    } catch (err) {
      console.error('VectorDbPanel fetch error:', err);
      setError('Failed to load vector DB stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const cards = [
    {
      label: 'Total Vectors',
      value: formatNumber(stats?.vectorCount),
      icon: <Layers className="w-5 h-5 text-orange-600" />,
      sub: 'embeddings indexed',
    },
    {
      label: 'Collections',
      value: formatNumber(stats?.tableCount),
      icon: <Database className="w-5 h-5 text-orange-600" />,
      sub: 'Milvus collections',
    },
    {
      label: 'Records',
      value: formatNumber(stats?.totalRecords),
      icon: <Database className="w-5 h-5 text-orange-600" />,
      sub: 'total rows',
    },
    {
      label: 'Index Size',
      value: formatBytes(stats?.indexSize),
      icon: <HardDrive className="w-5 h-5 text-orange-600" />,
      sub: 'on-disk size',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Vector DB (Milvus)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Embedding collections and index health
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(card => (
          <div
            key={card.label}
            className="bg-gradient-to-br from-orange-50 to-white dark:from-gray-800 dark:to-gray-900 border border-orange-100 dark:border-gray-700 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                {card.icon}
              </div>
              <span className="text-sm font-medium text-orange-600 dark:text-orange-300">
                {card.label}
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {card.value}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {stats?.collections && stats.collections.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Collection
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entities
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Index
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metric
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {stats.collections.map(col => (
                <tr key={col.name}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {col.name}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                    {formatNumber(col.entityCount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {col.indexType || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {col.metric || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
