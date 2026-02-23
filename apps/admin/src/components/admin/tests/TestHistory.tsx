'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, User, Calendar, Trash2 } from 'lucide-react';

interface TestResult {
  id: string;
  suiteId: string;
  suiteName: string;
  project: string;
  service: string;
  success: boolean;
  exitCode: number;
  duration: number;
  timestamp: string;
  userId: string;
  userEmail: string;
}

interface TestHistoryProps {
  suiteId?: string;
  project?: string;
  limit?: number;
}

export function TestHistory({ suiteId, project, limit = 50 }: TestHistoryProps) {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);

  useEffect(() => {
    loadHistory();
  }, [suiteId, project, limit]);

  const loadHistory = async () => {
    try {
      const params = new URLSearchParams();
      if (suiteId) params.append('suiteId', suiteId);
      if (project) params.append('project', project);
      params.append('limit', limit.toString());

      const response = await fetch(`/api/tests/history?${params}`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Failed to load test history:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm('Are you sure you want to clear all test history?')) {
      return;
    }

    try {
      await fetch('/api/tests/history', { method: 'DELETE' });
      setResults([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading history...</div>;
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8 bg-white border border-gray-200 rounded-lg">
        <p className="text-gray-600">No test results yet</p>
      </div>
    );
  }

  // Calculate stats
  const totalRuns = results.length;
  const passedRuns = results.filter((r) => r.success).length;
  const failedRuns = totalRuns - passedRuns;
  const passRate = totalRuns > 0 ? ((passedRuns / totalRuns) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{totalRuns}</div>
          <div className="text-sm text-gray-600">Total Runs</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{passedRuns}</div>
          <div className="text-sm text-gray-600">Passed</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{failedRuns}</div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{passRate}%</div>
          <div className="text-sm text-gray-600">Pass Rate</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={clearHistory}
          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <Trash2 className="w-4 h-4" />
          Clear History
        </button>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Test Suite
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Run By
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {results.map((result) => (
              <tr
                key={result.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedResult(result)}
              >
                <td className="px-4 py-3">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{result.suiteName}</div>
                  <div className="text-xs text-gray-500">{result.service}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">{result.project}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-sm text-gray-700">
                    <Clock className="w-4 h-4" />
                    {formatDuration(result.duration)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-sm text-gray-700">
                    <User className="w-4 h-4" />
                    {result.userEmail}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-sm text-gray-700">
                    <Calendar className="w-4 h-4" />
                    {formatDate(result.timestamp)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
