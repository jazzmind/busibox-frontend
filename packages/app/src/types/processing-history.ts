/**
 * Processing history payload types as returned by data-api `/files/:fileId/history`.
 *
 * These use snake_case to match the service payload.
 */

export type DataProcessingHistoryEntry = {
  id: string;
  stage: string;
  step_name: string;
  status: string;
  message: string;
  error_message?: string;
  metadata?: unknown;
  duration_ms?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
};

export type DataProcessingHistoryResponse = {
  history: DataProcessingHistoryEntry[];
};








