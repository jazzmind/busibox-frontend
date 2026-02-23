/**
 * System Status Card Component
 * 
 * Displays a compact overview of system services and their health status.
 * Used in both the setup wizard and admin dashboard.
 */

'use client';

import { useState } from 'react';
import { Button } from '@jazzmind/busibox-app';

type ServiceStatus = {
  name: string;
  status: string;
  health?: string;
  started_at?: string;
};

type InstallState = {
  phase: string;
  status: string;
  environment?: string;
  platform?: string;
  llmBackend?: string;
  adminEmail?: string;
};

type SystemStatusCardProps = {
  services: ServiceStatus[];
  installState?: InstallState | null;
  onRefresh?: () => Promise<void>;
  compact?: boolean;
};

export function SystemStatusCard({ 
  services, 
  installState, 
  onRefresh,
  compact = false 
}: SystemStatusCardProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Count service states
  const runningCount = services.filter(s => s.status === 'running').length;
  const healthyCount = services.filter(s => 
    s.status === 'running' && (!s.health || s.health === 'healthy')
  ).length;
  const totalCount = services.length;

  // Determine overall status
  const overallStatus = healthyCount === totalCount 
    ? 'healthy' 
    : healthyCount > 0 
      ? 'degraded' 
      : 'unhealthy';

  const statusColors = {
    healthy: 'bg-green-100 text-green-800 border-green-200',
    degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    unhealthy: 'bg-red-100 text-red-800 border-red-200',
  };

  const statusIcons = {
    running: (
      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    stopped: (
      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
      </svg>
    ),
    not_found: (
      <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
  };

  const getServiceIcon = (service: ServiceStatus) => {
    if (service.status === 'running') {
      return service.health === 'unhealthy' 
        ? statusIcons.error 
        : statusIcons.running;
    }
    return statusIcons[service.status as keyof typeof statusIcons] || statusIcons.not_found;
  };

  const formatServiceName = (name: string) => {
    // Convert container names like "dev-postgres" to "PostgreSQL"
    const nameMap: Record<string, string> = {
      'postgres': 'PostgreSQL',
      'authz-api': 'AuthZ API',
      'deploy-api': 'Deploy API',
      'busibox-portal': 'Busibox Portal',
      'nginx': 'Nginx',
      'redis': 'Redis',
      'minio': 'MinIO',
      'milvus': 'Milvus',
      'litellm': 'LiteLLM',
      'data-api': 'Data API',
      'search-api': 'Search API',
      'agent-api': 'Agent API',
    };

    // Extract service name from container name (e.g., "dev-postgres" -> "postgres")
    const baseName = name.replace(/^[a-z]+-/, '');
    return nameMap[baseName] || baseName;
  };

  if (compact) {
    return (
      <div className={`rounded-lg border p-4 ${statusColors[overallStatus]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              overallStatus === 'healthy' ? 'bg-green-500' :
              overallStatus === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <div>
              <p className="font-medium">System Status</p>
              <p className="text-sm opacity-75">
                {healthyCount}/{totalCount} services healthy
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <svg 
                className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 ${statusColors[overallStatus]} border-b`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${
              overallStatus === 'healthy' ? 'bg-green-500' :
              overallStatus === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <div>
              <h3 className="font-semibold text-lg">System Status</h3>
              <p className="text-sm opacity-75">
                {healthyCount} of {totalCount} services healthy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {installState && (
              <span className="px-3 py-1 bg-white/50 rounded-full text-sm font-medium capitalize">
                {installState.phase || 'bootstrap'}
              </span>
            )}
            {onRefresh && (
              <Button
                variant="secondary"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="p-6">
        {services.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No service information available
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {services.map(service => (
              <div 
                key={service.name}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
              >
                {getServiceIcon(service)}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {formatServiceName(service.name)}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {service.status === 'running' && service.health 
                      ? service.health 
                      : service.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Install State Info */}
        {installState && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Installation Details</h4>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {installState.environment && (
                <div>
                  <dt className="text-gray-500">Environment</dt>
                  <dd className="font-medium text-gray-900 capitalize">{installState.environment}</dd>
                </div>
              )}
              {installState.platform && (
                <div>
                  <dt className="text-gray-500">Platform</dt>
                  <dd className="font-medium text-gray-900 capitalize">{installState.platform}</dd>
                </div>
              )}
              {installState.llmBackend && (
                <div>
                  <dt className="text-gray-500">LLM Backend</dt>
                  <dd className="font-medium text-gray-900 uppercase">{installState.llmBackend}</dd>
                </div>
              )}
              {installState.adminEmail && (
                <div>
                  <dt className="text-gray-500">Admin Email</dt>
                  <dd className="font-medium text-gray-900">{installState.adminEmail}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
