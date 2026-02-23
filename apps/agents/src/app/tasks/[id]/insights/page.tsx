'use client';

/**
 * Task Insights Page
 * Shows task-specific insights/memories that help the agent avoid duplicates.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDateTime } from '@jazzmind/busibox-app/lib/date-utils';
import { useAuth } from '@jazzmind/busibox-app';

interface Task {
  id: string;
  name: string;
  insights_config: {
    enabled?: boolean;
    max_insights?: number;
    purge_after_days?: number;
  };
}

interface TaskInsight {
  id: string;
  content: string;
  createdAt: string;
  executionId?: string;
}

export default function TaskInsightsPage() {
  const params = useParams();
  const taskId = params.id as string;
  const { isReady } = useAuth();
  
  const [task, setTask] = useState<Task | null>(null);
  const [insights, setInsights] = useState<TaskInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    loadTask();
    loadInsights();
  }, [isReady, taskId]);

  const loadTask = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) throw new Error('Failed to load task');
      const data = await response.json();
      setTask(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    }
  };

  const loadInsights = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/insights`);
      if (!response.ok) {
        // API might return 404 or error for unimplemented feature
        setInsights([]);
        return;
      }
      const data = await response.json();
      setInsights(data.insights || []);
    } catch (err) {
      console.error('Failed to load insights:', err);
      setInsights([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Error</h3>
          <p className="text-red-600 dark:text-red-300">{error}</p>
          <Link
            href={`/tasks/${taskId}`}
            className="mt-4 inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Back to Task
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/tasks/${taskId}`}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-4 inline-block"
        >
          ← Back to Task
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Task Insights
        </h1>
        {task && (
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Memories for: {task.name}
          </p>
        )}
      </div>

      {/* Configuration Summary */}
      {task?.insights_config && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Configuration</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Status:</span>
              <span className={`ml-2 ${task.insights_config.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {task.insights_config.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Max Insights:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">{task.insights_config.max_insights || 50}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Auto-purge:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {task.insights_config.purge_after_days ? `${task.insights_config.purge_after_days} days` : 'Never'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Insights List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Stored Insights ({insights.length})
        </h2>
        
        {insights.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🧠</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Insights Yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Task insights are memories extracted from previous executions.
              They help the agent avoid sending duplicate information and maintain context
              across runs.
            </p>
            <p className="text-gray-500 dark:text-gray-400 mt-4 text-sm">
              Insights will appear here after your task runs and produces results.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <p className="text-gray-900 dark:text-gray-100">{insight.content}</p>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Created: {formatDateTime(insight.createdAt)}
                  {insight.executionId && (
                    <span className="ml-4">Execution: {insight.executionId.slice(0, 8)}...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
          How Task Insights Work
        </h3>
        <ul className="text-blue-700 dark:text-blue-300 space-y-2 text-sm">
          <li>• After each task execution, key information is extracted and stored as insights</li>
          <li>• These insights are provided to the agent on subsequent runs as context</li>
          <li>• This helps the agent avoid reporting the same news/information multiple times</li>
          <li>• Old insights are automatically purged based on your configuration</li>
        </ul>
      </div>
    </div>
  );
}
