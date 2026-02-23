/**
 * Shared document-related types used by document UI components.
 *
 * NOTE: This file intentionally avoids Prisma types. It models API payloads.
 */

export interface TagGroup {
  name: string;
  tags: string[];
  documentCount: number;
  confidence?: number;
}

export interface DocumentWithUser {
  id: string;
  filename?: string | null;
  originalFilename?: string | null;
  size?: number | null;
  mimeType?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  tags?: string[] | null;
  user: {
    email: string;
  };
  // Allow unknown additional fields from API
  [key: string]: unknown;
}

export interface TocItem {
  level: number;
  title: string;
  id: string;
}

export interface DocumentChunk {
  chunk_id: string;
  chunk_index: number;
  text: string;
  page_number?: number;
  section_heading?: string;
  token_count: number;
  processing_strategy?: string;
}

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










