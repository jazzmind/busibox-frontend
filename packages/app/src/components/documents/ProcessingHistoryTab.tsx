'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import type { DataProcessingHistoryEntry } from '../../types/processing-history';
import { useBusiboxApi, useCrossAppApiPath } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';

interface ProcessingHistoryTabProps {
  fileId: string;
}

export function ProcessingHistoryTab({ fileId }: ProcessingHistoryTabProps) {
  const api = useBusiboxApi();
  const resolve = useCrossAppApiPath();
  const [history, setHistory] = useState<DataProcessingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(['parsing', 'chunking', 'embedding', 'indexing']));

  useEffect(() => {
    fetchHistory();
  }, [fileId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const servicePath = `/files/${fileId}/history`;
      const nextPath = resolve('documents', `/api/documents/${fileId}/history`);

      const response = await fetchServiceFirstFallbackNext({
        service: { baseUrl: api.services?.dataApiUrl, path: servicePath, init: { method: 'GET' } },
        next: { nextApiBasePath: api.nextApiBasePath, path: nextPath, init: { method: 'GET' } },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: [
            ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
            400,
            401,
            403,
          ],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Failed to fetch history: ${response.statusText}`);
      }
      
      const data = await response.json();
      setHistory((data.history || []) as DataProcessingHistoryEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load processing history');
      console.error('Error fetching processing history:', err);
    } finally {
      setLoading(false);
    }
  };

  type ProcessingHistoryGroup = {
    stage: string;
    steps: DataProcessingHistoryEntry[];
    startedAt: string;
    completedAt: string | null;
    duration: number | null;
    status: 'in_progress' | 'completed' | 'failed';
  };

  const groupByStage = (steps: DataProcessingHistoryEntry[]): ProcessingHistoryGroup[] => {
    const dataStageMap = new Map<string, DataProcessingHistoryEntry[]>();
    
    steps.forEach(step => {
      const existing = dataStageMap.get(step.stage) || [];
      existing.push(step);
      dataStageMap.set(step.stage, existing);
    });

    return Array.from(dataStageMap.entries()).map(([stage, steps]) => {
      const sortedSteps = steps.sort(
        (a, b) =>
          new Date(a.started_at || a.created_at || 0).getTime() -
          new Date(b.started_at || b.created_at || 0).getTime()
      );
      
      const startedAt = sortedSteps[0]?.started_at || sortedSteps[0]?.created_at || '';
      const lastStep = sortedSteps[sortedSteps.length - 1];
      const completedAt = lastStep?.completed_at ?? null;
      
      let duration: number | null = null;
      if (startedAt && completedAt) {
        duration = (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000;
      }

      const hasFailure = sortedSteps.some((s) => s.status === 'failed' || s.status === 'error');
      const allCompleted = sortedSteps.every((s) => s.status === 'completed' || s.status === 'skipped');
      const status = hasFailure ? 'failed' : allCompleted ? 'completed' : 'in_progress';

      return {
        stage,
        steps: sortedSteps,
        startedAt,
        completedAt,
        duration,
        status,
      };
    });
  };

  const toggleStage = (stage: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  };

  const getStatusIcon = (status: string, hasCompletedAt: boolean = false) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'failed':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'started':
        // If step has completedAt, treat as completed (backend didn't update status)
        return hasCompletedAt 
          ? <CheckCircle2 className="w-5 h-5 text-green-600" />
          : <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'skipped':
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    if (seconds < 60) return `${seconds.toFixed(2)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getStageName = (stage: string) => {
    const names: Record<string, string> = {
      'queued': 'Queued',
      'parsing': 'Text Extraction',
      'classifying': 'Classification',
      'extracting_metadata': 'Metadata Extraction',
      'chunking': 'Text Chunking',
      'cleanup': 'LLM Cleanup',
      'entity_extraction': 'Entity Extraction (Legacy)',
      'embedding': 'Embedding Generation',
      'indexing': 'Vector Indexing',
      'completed': 'Completed',
      'failed': 'Failed',
    };
    return names[stage] || stage;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading processing history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error Loading History</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No processing history available yet.</p>
        <p className="text-sm text-gray-500 mt-2">History will appear as the document is processed.</p>
      </div>
    );
  }

  const groups = groupByStage(history);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Processing History</h2>
          <p className="text-sm text-gray-600 mt-1">Detailed timeline of document processing steps</p>
        </div>
        <button
          onClick={fetchHistory}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Clock className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.stage} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Stage Header */}
            <button
              onClick={() => toggleStage(group.stage)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {expandedStages.has(group.stage) ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
                {getStatusIcon(group.status, !!group.completedAt)}
                <span className="font-medium text-gray-900">{getStageName(group.stage)}</span>
                <span className="text-sm text-gray-500">({group.steps.length} steps)</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {group.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDuration(group.duration)}
                  </span>
                )}
              </div>
            </button>

            {/* Stage Steps */}
            {expandedStages.has(group.stage) && (
              <div className="bg-white divide-y divide-gray-100">
                {group.steps.map((step) => (
                  <div key={step.id} className="px-4 py-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(step.status)}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{step.step_name}</div>
                          {step.message && (
                            <p className="text-sm text-gray-600 mt-1">{step.message}</p>
                          )}
                        </div>
                      </div>
                      {typeof step.duration_ms === 'number' && (
                        <span className="text-sm text-gray-500 ml-4">
                          {formatDuration(step.duration_ms / 1000)}
                        </span>
                      )}
                    </div>

                    {/* Metadata */}
                    {step.metadata !== undefined &&
                      step.metadata !== null &&
                      typeof step.metadata === 'object' &&
                      Object.keys(step.metadata as Record<string, unknown>).length > 0 && (
                      <div className="mt-3 ml-8 bg-gray-50 rounded-md p-3">
                        <div className="text-xs font-medium text-gray-700 mb-2">Details:</div>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          {Object.entries(step.metadata as Record<string, unknown>).map(([key, value]) => (
                            <div key={key}>
                              <dt className="text-gray-500 font-medium">{key}:</dt>
                              <dd className="text-gray-900 mt-0.5">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}

                    {/* Error */}
                    {step.error_message && (
                      <div className="mt-3 ml-8 bg-red-50 border border-red-200 rounded-md p-3">
                        <div className="text-xs font-medium text-red-800 mb-1">Error:</div>
                        <p className="text-xs text-red-700">{step.error_message}</p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="mt-3 ml-8 flex gap-6 text-xs text-gray-500">
                      {step.started_at && (
                        <div>
                          <span className="font-medium">Started:</span> {formatTimestamp(step.started_at)}
                        </div>
                      )}
                      {step.completed_at && (
                        <div>
                          <span className="font-medium">Completed:</span> {formatTimestamp(step.completed_at)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

