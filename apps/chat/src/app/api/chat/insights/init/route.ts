/**
 * Chat Insights Initialization API
 * 
 * GET /api/chat/insights/init - Initialize background job (called on server startup)
 * 
 * This route should be called during application startup to initialize
 * the insight extraction background job.
 */

import { NextRequest } from 'next/server';
import { successResponse, withErrorHandling } from '@jazzmind/busibox-app/lib/agent/chat-middleware';
import { startInsightExtractionJob } from '@/jobs/insight-extraction';
import { initializeChatInsightsCollection } from '@jazzmind/busibox-app/lib/agent/insights';

// Track if job has been initialized
let jobInitialized = false;

/**
 * GET /api/chat/insights/init
 * 
 * Initialize insight extraction background job and Milvus collection
 */
export const GET = withErrorHandling(
  async (request: NextRequest) => {
    // Only initialize once
    if (jobInitialized) {
      return successResponse({
        status: 'already_initialized',
        message: 'Background job already initialized',
      });
    }

    try {
      // Initialize Milvus collection if needed
      // During build/prerender, this will fail gracefully
      try {
        await initializeChatInsightsCollection();
      } catch (initError: any) {
        // If this is a prerender error, skip initialization
        if (initError?.digest === 'HANGING_PROMISE_REJECTION') {
          return successResponse({
            status: 'skipped',
            message: 'Skipped during prerender',
          });
        }
        throw initError;
      }

      // Start background job
      startInsightExtractionJob();

      jobInitialized = true;

      return successResponse({
        status: 'initialized',
        message: 'Insight extraction background job started',
      });
    } catch (error: any) {
      console.error('Failed to initialize insight extraction:', error);
      return successResponse(
        {
          status: 'error',
          message: error.message || 'Failed to initialize',
        },
        500
      );
    }
  }
);

