/**
 * Insight Extraction Background Job
 * 
 * Periodically extracts insights from conversations and stores them in Milvus.
 * Runs every 5 minutes (configurable via INSIGHT_EXTRACTION_INTERVAL env var).
 */

import cron, { ScheduledTask } from 'node-cron';
import { extractInsights } from '@jazzmind/busibox-app/lib/agent/chat-insights';

const INTERVAL_MINUTES = parseInt(
  process.env.INSIGHT_EXTRACTION_INTERVAL_MINUTES || '5',
  10
);

let jobRunning = false;
let jobInstance: ScheduledTask | null = null;

/**
 * Run insight extraction job
 */
async function runInsightExtraction() {
  // Prevent concurrent runs
  if (jobRunning) {
    console.log('[Insight Extraction] Job already running, skipping...');
    return;
  }

  jobRunning = true;
  const startTime = Date.now();

  try {
    const token = process.env.INSIGHT_EXTRACTION_AGENT_TOKEN;
    if (!token) {
      console.log('[Insight Extraction] Skipping: INSIGHT_EXTRACTION_AGENT_TOKEN not set');
      return;
    }

    console.log('[Insight Extraction] Starting job...');
    const result = await extractInsights(token);

    const duration = Date.now() - startTime;
    console.log(
      `[Insight Extraction] Job completed in ${duration}ms: ` +
      `processed ${result.processed} conversations, ` +
      `extracted ${result.insightsExtracted} insights`
    );

    if (result.errors.length > 0) {
      console.warn(
        `[Insight Extraction] ${result.errors.length} errors occurred:`,
        result.errors
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[Insight Extraction] Job failed after ${duration}ms:`,
      error
    );
  } finally {
    jobRunning = false;
  }
}

/**
 * Start the insight extraction background job
 * 
 * @param enabled - Whether to enable the job (default: from env var)
 */
export function startInsightExtractionJob(enabled?: boolean): void {
  const shouldEnable = enabled ?? process.env.ENABLE_INSIGHT_EXTRACTION !== 'false';

  if (!shouldEnable) {
    console.log('[Insight Extraction] Job disabled via configuration');
    return;
  }

  // Stop existing job if running
  if (jobInstance) {
    stopInsightExtractionJob();
  }

  // Schedule job to run every N minutes
  const cronExpression = `*/${INTERVAL_MINUTES} * * * *`;
  
  console.log(
    `[Insight Extraction] Starting background job (runs every ${INTERVAL_MINUTES} minutes)`
  );

  jobInstance = cron.schedule(cronExpression, runInsightExtraction, {
    timezone: 'UTC',
  });

  // Run immediately on startup (optional, can be disabled)
  if (process.env.INSIGHT_EXTRACTION_RUN_ON_STARTUP !== 'false') {
    // Run after a short delay to allow server to fully start
    setTimeout(() => {
      runInsightExtraction().catch((error) => {
        console.error('[Insight Extraction] Initial run failed:', error);
      });
    }, 10000); // 10 seconds delay
  }
}

/**
 * Stop the insight extraction background job
 */
export function stopInsightExtractionJob(): void {
  if (jobInstance) {
    jobInstance.stop();
    jobInstance = null;
    console.log('[Insight Extraction] Background job stopped');
  }
}

/**
 * Manually trigger insight extraction (for testing/admin)
 */
export async function triggerInsightExtraction(
  token: string,
  userId?: string
): Promise<{
  processed: number;
  insightsExtracted: number;
  errors: Array<{ conversationId: string; error: string }>;
}> {
  return extractInsights(token, userId);
}

