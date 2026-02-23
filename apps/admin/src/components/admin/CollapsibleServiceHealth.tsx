/**
 * Collapsible Service Health Panel
 * 
 * A compact summary button that shows service health status (e.g., "10/10 services healthy")
 * and expands to show detailed status of each service grouped by tier.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, CheckCircle, XCircle, AlertCircle, Circle } from 'lucide-react';
import { useCustomization } from '@jazzmind/busibox-app';

type ServiceStatus = {
  id: string;
  name: string;
  tier: 'infrastructure' | 'llm' | 'api' | 'apps';
  tierLabel: string;
  description: string;
  status: 'running' | 'stopped' | 'starting' | 'error' | 'unknown';
  health: 'healthy' | 'unhealthy' | 'unknown';
  order: number;
  rawStatus?: string;
  rawState?: string;
  consolidatedFrom?: string[];
};

type TierInfo = {
  id: string;
  label: string;
  order: number;
};

type ServicesByTier = {
  infrastructure: ServiceStatus[];
  llm: ServiceStatus[];
  api: ServiceStatus[];
  apps: ServiceStatus[];
};

type CollapsibleServiceHealthProps = {
  className?: string;
};

export function CollapsibleServiceHealth({ 
  className = '',
}: CollapsibleServiceHealthProps) {
  const { customization } = useCustomization();
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [byTier, setByTier] = useState<ServicesByTier>({ infrastructure: [], llm: [], api: [], apps: [] });
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchServiceStatus = useCallback(async (fresh = false) => {
    try {
      const url = fresh ? '/api/services/status?fresh=true' : '/api/services/status';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setServices(data.data.services || []);
          setByTier(data.data.byTier || { infrastructure: [], llm: [], api: [], apps: [] });
          setTiers(data.data.tiers || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch service status:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch once on mount — no automatic polling.
  // Service status doesn't change frequently enough to justify continuous polling.
  useEffect(() => {
    fetchServiceStatus();
  }, [fetchServiceStatus]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchServiceStatus(true); // bypass server cache on manual refresh
  };

  // Calculate health summary
  const healthyCount = services.filter(s => 
    s.status === 'running' && (s.health === 'healthy' || s.health === 'unknown')
  ).length;
  const totalCount = services.length;
  const allHealthy = healthyCount === totalCount && totalCount > 0;
  const someHealthy = healthyCount > 0;

  // Get status color classes
  const getStatusColor = () => {
    if (isLoading) return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400';
    if (allHealthy) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400';
    if (someHealthy) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400';
    return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400';
  };

  const getStatusIcon = () => {
    if (isLoading) return <Circle className="w-4 h-4 animate-pulse" />;
    if (allHealthy) return <CheckCircle className="w-4 h-4" />;
    if (someHealthy) return <AlertCircle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  const getServiceIcon = (service: ServiceStatus) => {
    if (service.status === 'running') {
      if (service.health === 'unhealthy') {
        return <XCircle className="w-4 h-4 text-red-500" />;
      }
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (service.status === 'starting') {
      return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
    }
    if (service.status === 'error') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <Circle className="w-4 h-4 text-gray-400" />;
  };

  const getStatusText = (service: ServiceStatus) => {
    if (service.status === 'running') {
      return service.health === 'unhealthy' ? 'unhealthy' : 'up';
    }
    return service.status;
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${getStatusColor()} ${className}`}>
      {/* Summary Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div className="text-left">
            <span className="font-medium">
              {isLoading ? 'Checking services...' : `${healthyCount}/${totalCount} services healthy`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                handleRefresh();
              }
            }}
            aria-disabled={isRefreshing}
            className={`p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${isRefreshing ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {/* Expanded Service List - Grouped by Tier */}
      {isExpanded && (
        <div className="border-t border-current/10 bg-white dark:bg-gray-900">
          <div className="p-4 space-y-4">
            {tiers.map((tier) => {
              const tierServices = byTier[tier.id as keyof ServicesByTier] || [];
              if (tierServices.length === 0) return null;
              
              return (
                <div key={tier.id}>
                  {/* Tier Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span 
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: customization.primaryColor }}
                    >
                      {tier.label}
                    </span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>
                  
                  {/* Tier Services */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {tierServices.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        {getServiceIcon(service)}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {service.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {getStatusText(service)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Quick Link to Full System Page */}
          <div className="px-4 pb-4">
            <a
              href="/system"
              className="block w-full text-center py-2 px-4 text-white text-sm font-medium rounded-lg transition-colors hover:opacity-90"
              style={{ backgroundColor: customization.primaryColor }}
            >
              View System Dashboard →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
