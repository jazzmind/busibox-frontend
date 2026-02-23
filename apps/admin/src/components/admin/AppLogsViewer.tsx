'use client';

import { useState, useEffect, useCallback } from 'react';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  type: 'stdout' | 'stderr';
}

interface AppLogsViewerProps {
  appId: string;
  appName: string;
}

export function AppLogsViewer({ appId, appName }: AppLogsViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/apps/${appId}/logs?lines=${lines}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [appId, lines]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 5 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const getLogLevelColor = (level: string, type: string) => {
    if (type === 'stderr' || level === 'error') return 'text-red-400';
    if (level === 'warn') return 'text-yellow-400';
    return 'text-gray-300';
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
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Application Logs</h3>
            <p className="text-sm text-gray-600 mt-1">
              Viewing logs for {appName}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="lines" className="text-sm text-gray-700">
                Lines:
              </label>
              <select
                id="lines"
                value={lines}
                onChange={(e) => setLines(parseInt(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
                <option value="1000">1000</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-refresh (5s)
            </label>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <div className="font-mono text-xs leading-relaxed">
            {logs.length === 0 && !loading && !error && (
              <p className="text-gray-500">No logs available</p>
            )}
            
            {logs.map((log, index) => (
              <div key={index} className="flex gap-4 hover:bg-gray-800 px-2 py-1">
                <span className="text-gray-500 flex-shrink-0">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className={`flex-shrink-0 ${getLogLevelColor(log.level, log.type)}`}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className={getLogLevelColor(log.level, log.type)}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>
            💡 <strong>Tip:</strong> To view logs in real-time from the terminal:
          </p>
          <div className="mt-2 p-3 bg-gray-100 rounded font-mono text-xs">
            # From host:<br />
            bash scripts/tail-app-logs.sh {appName} production<br />
            <br />
            # From container:<br />
            journalctl -u {appName}.service -f
          </div>
        </div>
      </div>
    </div>
  );
}

