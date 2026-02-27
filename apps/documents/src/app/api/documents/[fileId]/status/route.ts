/**
 * Document Status API Route
 * 
 * Fetches document processing status from data-api (source of truth).
 * No longer relies on Busibox Portal's local database for document info.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    
    // Set session JWT for Zero Trust token exchange
    setSessionJwtForUser(user.id, sessionJwt);
    
    const { fileId } = await params;

    // Fetch document details from data-api (source of truth)
    // RLS in data-api will verify ownership
    try {
      const response = await dataFetch(
        `GET /api/documents/[fileId]/status - get document status ${fileId}`,
        `/files/${fileId}`,
        {
          userId: user.id,  // Required for authz token exchange (RLS passthrough)
          timeout: 10000,   // 10 second timeout
        }
      );

      const data = await response.json();

      // Return status from data-api (pass through all status fields)
      return apiSuccess({
        fileId: data.fileId,
        filename: data.filename,
        originalFilename: data.originalFilename,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        contentHash: data.contentHash || null,
        visibility: data.visibility || 'personal',
        libraryId: data.libraryId || null,
        status: {
          stage: data.status?.stage || 'unknown',
          progress: data.status?.progress ?? null,
          chunksProcessed: data.status?.chunksProcessed ?? null,
          totalChunks: data.status?.totalChunks ?? null,
          pagesProcessed: data.status?.pagesProcessed ?? null,
          totalPages: data.status?.totalPages ?? null,
          errorMessage: data.status?.errorMessage || null,
          statusMessage: data.status?.statusMessage || null,
          processingPass: data.status?.processingPass ?? null,
          passDetails: data.status?.passDetails || null,
          startedAt: data.status?.startedAt || null,
          completedAt: data.status?.completedAt || null,
          updatedAt: data.status?.updatedAt || null,
        },
        documentType: data.documentType,
        primaryLanguage: data.primaryLanguage,
        detectedLanguages: data.detectedLanguages || null,
        classificationConfidence: data.classificationConfidence || null,
        chunkCount: data.chunkCount || 0,
        vectorCount: data.vectorCount || 0,
        processingDurationSeconds: data.processingDurationSeconds || null,
        extractedTitle: data.extractedTitle,
        extractedAuthor: data.extractedAuthor,
        extractedDate: data.extractedDate || null,
        extractedKeywords: data.extractedKeywords,
        metadata: data.metadata || {},
        processingStrategies: data.processingStrategies || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    } catch (ingestError: any) {
      // Error is already logged by dataFetch with context
      // 404 means file not found or access denied (RLS)
      if (ingestError.statusCode === 404) {
        return apiError('Document not found', 404);
      }
      if (ingestError.statusCode === 403) {
        return apiError('Unauthorized', 403);
      }
      
      console.error('[API] Document status error from data-api:', ingestError);
      return apiError('Failed to fetch document status', ingestError.statusCode || 500);
    }
  } catch (error: any) {
    console.error('[API] Document status error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

