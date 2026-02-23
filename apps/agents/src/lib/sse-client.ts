/**
 * Server-Sent Events (SSE) Client Utility
 *
 * Provides robust SSE connection management for real-time agent run updates.
 * Generic SSE types/classes come from @jazzmind/busibox-app; agent-specific
 * RunStreamClient and RunStreamConnectionManager are defined here.
 */

import {
  SSEClient,
  SSEConnectionManager,
  type SSEConnectionState,
  type SSEEvent,
  type SSEOptions,
  type SSECallbacks,
} from '@jazzmind/busibox-app/lib/sse';
import { Run, RunEvent } from './types';
import { logError } from './error-handler';

// Re-export generic types and classes from shared package
export type {
  SSEConnectionState,
  SSEEvent,
  SSEOptions,
  SSECallbacks,
};
export { SSEClient, SSEConnectionManager } from '@jazzmind/busibox-app/lib/sse';

// ==========================================================================
// RUN STREAM TYPES
// ==========================================================================

export interface RunStreamEvent {
  type: 'status' | 'event' | 'complete' | 'error';
  run?: Run;
  event?: RunEvent;
  error?: string;
}

export interface RunStreamCallbacks {
  onStatusUpdate?: (run: Run) => void;
  onEvent?: (event: RunEvent) => void;
  onComplete?: (run: Run) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

// ==========================================================================
// RUN STREAM CLIENT
// ==========================================================================

/**
 * Specialized SSE client for agent run streams
 */
export class RunStreamClient extends SSEClient {
  private runCallbacks: RunStreamCallbacks;

  constructor(
    runId: string,
    callbacks: RunStreamCallbacks = {},
    options: SSEOptions = {}
  ) {
    const url = `/api/streams/runs/${runId}`;

    super(url, options, {
      onMessage: (event) => this.handleRunEvent(event),
      onError: callbacks.onError,
      onClose: callbacks.onClose,
    });

    this.runCallbacks = callbacks;
  }

  private handleRunEvent(event: SSEEvent): void {
    const streamEvent = event.data as RunStreamEvent;

    switch (streamEvent.type) {
      case 'status':
        if (streamEvent.run) {
          this.runCallbacks.onStatusUpdate?.(streamEvent.run);
        }
        break;

      case 'event':
        if (streamEvent.event) {
          this.runCallbacks.onEvent?.(streamEvent.event);
        }
        break;

      case 'complete':
        if (streamEvent.run) {
          this.runCallbacks.onComplete?.(streamEvent.run);
        }
        this.close();
        break;

      case 'error':
        const error = new Error(streamEvent.error || 'Run error');
        this.runCallbacks.onError?.(error);
        logError(error, 'RunStreamClient.handleRunEvent');
        this.close();
        break;
    }
  }
}

// ==========================================================================
// RUN STREAM CONNECTION MANAGER
// ==========================================================================

/**
 * Manages multiple SSE connections with run stream support.
 * Extends the generic SSEConnectionManager with createRunStream.
 */
export class RunStreamConnectionManager extends SSEConnectionManager {
  /**
   * Create a run stream connection
   */
  createRunStream(
    runId: string,
    callbacks?: RunStreamCallbacks,
    options?: SSEOptions
  ): RunStreamClient | null {
    if (this.connections.size >= this.maxConnections) {
      console.error('[SSEConnectionManager] Max connections reached');
      return null;
    }

    this.closeConnection(runId);

    const client = new RunStreamClient(
      runId,
      {
        ...callbacks,
        onClose: () => {
          this.connections.delete(runId);
          callbacks?.onClose?.();
        },
      },
      options
    );

    this.connections.set(runId, client);
    client.connect();

    return client;
  }
}

// Global run stream manager (singleton)
let globalRunStreamManager: RunStreamConnectionManager | null = null;

/**
 * Get the SSE connection manager with run stream support.
 * Returns RunStreamConnectionManager which includes createRunStream for agent runs.
 */
export function getSSEManager(): RunStreamConnectionManager {
  if (!globalRunStreamManager) {
    const maxStreams = parseInt(process.env.MAX_SSE_STREAMS || '100', 10);
    globalRunStreamManager = new RunStreamConnectionManager(maxStreams);
  }
  return globalRunStreamManager;
}
