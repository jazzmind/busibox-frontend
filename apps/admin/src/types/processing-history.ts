export interface ProcessingHistoryStep {
  stepId: string;
  fileId: string;
  stage: string;
  stepName: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  message: string | null;
  metadata: Record<string, any> | null;
  errorMessage: string | null;
  stackTrace: string | null;
}

export interface ProcessingHistoryGroup {
  stage: string;
  steps: ProcessingHistoryStep[];
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  status: 'in_progress' | 'completed' | 'failed' | 'partial';
}


