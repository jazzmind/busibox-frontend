/**
 * ServiceLogsViewer Component
 * 
 * Comprehensive log viewer for all services with filtering and auto-refresh.
 * Services list is dynamically fetched from the API.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@jazzmind/busibox-app';

interface LogEntry {
  timestamp: string;
  service: string;
  level: string;
  message: string;
  details?: any;
}

interface ServiceOption {
  value: string;
  label: string;
  color: string;
}

// Generate a consistent color for a service name
function getServiceColorClass(serviceName: string): string {
  const colorMap: Record<string, string> = {
    'busibox-portal': 'text-blue-400',
    'data-api': 'text-green-400',
    'data-worker': 'text-purple-400',
    'search-api': 'text-cyan-400',
    'busibox-agents': 'text-yellow-400',
    'agent-server': 'text-pink-400',
  };
  return colorMap[serviceName] || 'text-gray-400';
}

// Format service name to a readable label
function formatServiceLabel(serviceName: string): string {
  return serviceName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const LOG_LEVELS = [
  { value: 'all', label: 'All Levels' },
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warning' },
  { value: 'info', label: 'Info' },
] as const;

const LINE_LIMITS = [100, 200, 500, 1000] as const;

export function ServiceLogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [availableServices, setAvailableServices] = useState<ServiceOption[]>([
    { value: 'all', label: 'All Services', color: 'text-gray-400' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [lineLimit, setLineLimit] = useState<number>(200);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  
  // Auto-scroll
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        service: selectedService,
        limit: lineLimit.toString(),
      });

      const response = await fetch(`/api/logs?${params}`);
      const json = await response.json();
      
      if (!response.ok || !json.success) {
        throw new Error(json.error || json.data?.error || 'Failed to fetch logs');
      }

      const payload = json.data;
      setLogs(payload.logs || []);
      
      if (payload.availableServices && Array.isArray(payload.availableServices)) {
        const services: ServiceOption[] = [
          { value: 'all', label: 'All Services', color: 'text-gray-400' },
          ...payload.availableServices.map((svc: string) => ({
            value: svc,
            label: formatServiceLabel(svc),
            color: getServiceColorClass(svc),
          })),
        ];
        setAvailableServices(services);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [selectedService, lineLimit]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchLogs, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchLogs]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setAutoScroll(isAtBottom);
  };

  const scrollToBottom = () => {
    setAutoScroll(true);
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Filter logs by level and search query
  const filteredLogs = logs.filter(log => {
    if (selectedLevel !== 'all' && log.level !== selectedLevel) {
      return false;
    }
    
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  const getServiceColor = (service: string) => {
    return availableServices.find(s => s.value === service)?.color || getServiceColorClass(service);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    // Handle 'unknown' or invalid timestamps
    if (!timestamp || timestamp === 'unknown') {
      return 'Unknown';
    }
    
    try {
      const date = new Date(timestamp);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Controls */}
      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Service Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service
            </label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableServices.map(service => (
                <option key={service.value} value={service.value}>
                  {service.label}
                </option>
              ))}
            </select>
          </div>

          {/* Level Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Log Level
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LOG_LEVELS.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          {/* Line Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lines
            </label>
            <select
              value={lineLimit}
              onChange={(e) => setLineLimit(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LINE_LIMITS.map(limit => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Refresh (seconds)
            </label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="2">2</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="30">30</option>
            </select>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter messages..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={fetchLogs}
              loading={loading}
              disabled={loading}
            >
              🔄 Refresh
            </Button>

            <Button
              variant={autoRefresh ? 'primary' : 'secondary'}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? '⏸ Pause' : '▶️ Auto'}
            </Button>

            {!autoScroll && (
              <Button
                variant="secondary"
                onClick={scrollToBottom}
              >
                ⬇️ Bottom
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-6 text-sm text-gray-600">
          <span>
            Total: <strong className="text-gray-900">{logs.length}</strong>
          </span>
          <span>
            Filtered: <strong className="text-gray-900">{filteredLogs.length}</strong>
          </span>
          <span>
            {autoRefresh && (
              <span className="text-green-600">
                ● Auto-refreshing every {refreshInterval}s
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Logs Display */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div
          ref={logsContainerRef}
          onScroll={handleScroll}
          className="bg-gray-900 rounded-lg p-4 overflow-x-auto max-h-[600px] overflow-y-auto"
        >
          <div className="font-mono text-xs leading-relaxed">
            {filteredLogs.length === 0 && !loading && !error && (
              <p className="text-gray-500">No logs available</p>
            )}
            
            {filteredLogs.map((log, index) => (
              <div key={index} className="flex gap-3 hover:bg-gray-800 px-2 py-1">
                <span className="text-gray-500 flex-shrink-0 w-32">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className={`flex-shrink-0 w-32 font-semibold ${getServiceColor(log.service)}`}>
                  [{log.service}]
                </span>
                <span className={`flex-shrink-0 w-16 ${getLevelColor(log.level)}`}>
                  {log.level.toUpperCase()}
                </span>
                <span className="text-gray-300 flex-1 break-all">
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>
            💡 <strong>Tip:</strong> Use the service filter to view logs from specific containers.
            Enable auto-refresh to monitor logs in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}

