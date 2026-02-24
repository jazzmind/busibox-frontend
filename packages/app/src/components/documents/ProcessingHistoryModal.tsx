'use client';

import { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, XCircle, AlertCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useBusiboxApi, useCrossAppApiPath } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';

interface ProcessingStep {
  id: string;
  stage: string;
  step_name: string;
  status: string;
  message: string;
  error_message?: string;
  metadata?: any;
  duration_ms?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

interface ProcessingStrategy {
  strategy: string;
  success: boolean;
  textLength?: number;
  chunkCount?: number;
  embeddingCount?: number;
  visualEmbeddingCount?: number;
  processingTimeSeconds?: number;
  errorMessage?: string;
  metadata?: any;
  attemptedAt?: string;
}

interface DocumentMetadata {
  fileId: string;
  filename: string;
  processingStrategies: ProcessingStrategy[];
  processingDurationSeconds: number | null;
  status: {
    stage: string;
    message?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ProcessingHistoryModalProps {
  fileId: string;
  document: DocumentMetadata;
  onClose: () => void;
}

export function ProcessingHistoryModal({ fileId, document, onClose }: ProcessingHistoryModalProps) {
  const api = useBusiboxApi();
  const resolve = useCrossAppApiPath();

  const [history, setHistory] = useState<ProcessingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);

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

      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
        const stagesWithErrors = new Set<string>(
          (data.history || [])
            .filter((h: ProcessingStep) => h.error_message || h.status === 'error')
            .map((h: ProcessingStep) => h.stage)
        );
        setExpandedStages(stagesWithErrors);
      } else {
        setError('Failed to load processing history');
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setError('Failed to load processing history');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(2)}s`;
    return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (status === 'error' || status === 'failed') return <XCircle className="w-4 h-4 text-red-600" />;
    if (status === 'started') return <Clock className="w-4 h-4 text-yellow-600" />;
    return <AlertCircle className="w-4 h-4 text-gray-400" />;
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      parsing: 'bg-blue-100 text-blue-800 border-blue-200',
      chunking: 'bg-purple-100 text-purple-800 border-purple-200',
      cleanup: 'bg-orange-100 text-orange-800 border-orange-200',
      markdown_generation: 'bg-pink-100 text-pink-800 border-pink-200',
      embedding: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      indexing: 'bg-green-100 text-green-800 border-green-200',
      completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[stage] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStageName = (stage: string) => {
    const names: Record<string, string> = {
      parsing: '📄 Parsing',
      chunking: '✂️ Chunking',
      cleanup: '🧹 LLM Cleanup',
      markdown_generation: '📝 Markdown Generation',
      embedding: '🧮 Embedding Generation',
      indexing: '📊 Vector Indexing',
      completed: '✅ Completed',
      failed: '❌ Failed',
    };
    return names[stage] || stage;
  };

  const groupedHistory = history.reduce((acc, step) => {
    if (!acc[step.stage]) acc[step.stage] = [];
    acc[step.stage].push(step);
    return acc;
  }, {} as Record<string, ProcessingStep[]>);

  const toggleStage = (stage: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stage)) newExpanded.delete(stage);
    else newExpanded.add(stage);
    setExpandedStages(newExpanded);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white text-gray-900">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Processing History</h2>
            <p className="text-sm text-gray-600 mt-1">{document.filename}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-600 hover:text-gray-900">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-600 mb-1">Total Duration</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatDuration(document.processingDurationSeconds ? document.processingDurationSeconds * 1000 : null)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-600 mb-1">Started</div>
              <div className="text-sm font-medium text-gray-900">{new Date(document.createdAt).toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-600 mb-1">Status</div>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  document.status?.stage === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : document.status?.stage === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {document.status?.stage || 'Unknown'}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading history...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-gray-600">{error}</p>
              <p className="text-sm text-gray-500 mt-1">Showing basic processing information instead</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No detailed processing history available</div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Steps</h3>

              {Object.entries(groupedHistory).map(([stage, steps]) => {
                const isExpanded = expandedStages.has(stage);
                const hasError = steps.some((s) => s.error_message || s.status === 'error');
                const stageDuration = steps.reduce((sum, s) => sum + (s.duration_ms || 0), 0);
                const lastStep = steps[steps.length - 1];

                return (
                  <div key={stage} className={`border rounded-lg ${hasError ? 'border-red-200' : 'border-gray-200'}`}>
                    <button
                      onClick={() => toggleStage(stage)}
                      className={`w-full p-4 flex items-center justify-between text-left rounded-t-lg ${
                        hasError ? 'bg-red-50' : 'bg-gray-50'
                      } hover:bg-opacity-75 transition-colors`}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStageColor(stage)}`}>{getStageName(stage)}</span>
                        <span className="text-sm text-gray-600">
                          {steps.length} step{steps.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        {hasError && <span className="text-xs text-red-600 font-medium">Has errors</span>}
                        <span className="text-xs text-gray-500">{formatDuration(stageDuration)}</span>
                        {getStatusIcon(lastStep.status)}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-4 space-y-3 border-t border-gray-200">
                        {steps.map((step) => (
                          <div key={step.id} className={`p-3 rounded-lg border ${step.error_message ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {getStatusIcon(step.status)}
                                  <span className="font-medium text-sm text-gray-900">{step.step_name}</span>
                                  <span className="text-xs text-gray-500">{formatDuration(step.duration_ms)}</span>
                                </div>
                                <p className="text-sm text-gray-700">{step.message}</p>
                                {step.error_message && (
                                  <p className="text-sm text-red-700 mt-2 font-mono bg-red-100 p-2 rounded">{step.error_message}</p>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 ml-4">{new Date(step.created_at).toLocaleTimeString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}










