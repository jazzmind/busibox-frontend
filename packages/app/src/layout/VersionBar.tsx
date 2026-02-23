'use client';

import { useEffect, useState } from 'react';
import { useBusiboxApi } from '../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../lib/http/fetch-with-fallback';

interface VersionInfo {
  type: string;
  branch: string;
  commit: string;
  shortCommit: string;
  deployed_at: string | null;
  deployed_by: string;
}

export function VersionBar() {
  const api = useBusiboxApi();
  const [version, setVersion] = useState<VersionInfo | null>(null);

  useEffect(() => {
    async function fetchVersion() {
      try {
        const response = await fetchServiceFirstFallbackNext({
          service: { baseUrl: undefined, path: '/version', init: { method: 'GET' } },
          next: { nextApiBasePath: api.nextApiBasePath, path: '/api/version', init: { method: 'GET' } },
          fallback: {
            fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
            fallbackStatuses: api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504],
          },
          serviceHeaders: api.serviceRequestHeaders,
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setVersion(data.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch version:', error);
      }
    }
    fetchVersion();
  }, [api.fallback?.fallbackOnNetworkError, api.fallback?.fallbackStatuses, api.nextApiBasePath, api.serviceRequestHeaders]);

  if (!version) {
    return null;
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-gray-800 text-gray-400 py-1 px-4 text-xs" data-version-bar>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span>
            <code className="text-gray-300">{version.branch}</code>
          </span>
          <span className="text-gray-600">•</span>
          <span>
            <code className="text-gray-300">{version.shortCommit}</code>
          </span>
          {version.deployed_at && (
            <>
              <span className="text-gray-600">•</span>
              <span>{formatDate(version.deployed_at)}</span>
            </>
          )}
        </div>
        <div>
          {version.type === 'development' ? (
            <span className="text-yellow-500 text-xs">DEV</span>
          ) : (
            <span className="text-green-500 text-xs">{version.type.toUpperCase()}</span>
          )}
        </div>
      </div>
    </div>
  );
}


