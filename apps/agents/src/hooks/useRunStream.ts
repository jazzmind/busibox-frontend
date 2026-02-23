/**
 * React Hook for Agent Run Streaming
 * 
 * Provides real-time updates for agent runs via Server-Sent Events (SSE).
 * Features:
 * - Automatic connection management
 * - Run status updates
 * - Event streaming
 * - Error handling
 * - Cleanup on unmount
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Run, RunEvent, RunStatus } from '@/lib/types';
import { RunStreamClient, SSEConnectionState, getSSEManager } from '@/lib/sse-client';

// ==========================================================================
// TYPES
// ==========================================================================

export interface UseRunStreamOptions {
  /**
   * Whether to automatically connect on mount
   * @default true
   */
  autoConnect?: boolean;

  /**
   * Whether to automatically reconnect on error
   * @default true
   */
  reconnect?: boolean;

  /**
   * Maximum reconnection attempts
   * @default 5
   */
  maxReconnectAttempts?: number;

  /**
   * Called when run status changes
   */
  onStatusChange?: (run: Run) => void;

  /**
   * Called when new event is received
   */
  onEvent?: (event: RunEvent) => void;

  /**
   * Called when run completes
   */
  onComplete?: (run: Run) => void;

  /**
   * Called on error
   */
  onError?: (error: Error) => void;
}

export interface UseRunStreamReturn {
  /** Current run data */
  run: Run | null;
  
  /** All events received */
  events: RunEvent[];
  
  /** Current connection state */
  connectionState: SSEConnectionState;
  
  /** Whether currently connected */
  isConnected: boolean;
  
  /** Whether run is still in progress */
  isRunning: boolean;
  
  /** Error if any */
  error: Error | null;
  
  /** Manually connect to stream */
  connect: () => void;
  
  /** Manually disconnect from stream */
  disconnect: () => void;
  
  /** Reconnect to stream */
  reconnect: () => void;
}

// ==========================================================================
// HOOK
// ==========================================================================

/**
 * Hook for streaming agent run updates
 * 
 * @example
 * ```tsx
 * function RunMonitor({ runId }: { runId: string }) {
 *   const { run, events, isConnected, isRunning } = useRunStream(runId, {
 *     onComplete: (run) => console.log('Run completed:', run),
 *     onError: (error) => console.error('Run error:', error),
 *   });
 * 
 *   return (
 *     <div>
 *       <div>Status: {run?.status}</div>
 *       <div>Events: {events.length}</div>
 *       <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useRunStream(
  runId: string | null | undefined,
  options: UseRunStreamOptions = {}
): UseRunStreamReturn {
  const {
    autoConnect = true,
    reconnect: shouldReconnect = true,
    maxReconnectAttempts = 5,
    onStatusChange,
    onEvent,
    onComplete,
    onError,
  } = options;

  // State
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected');
  const [error, setError] = useState<Error | null>(null);

  // Refs to store client and prevent stale closures
  const clientRef = useRef<RunStreamClient | null>(null);
  const runIdRef = useRef<string | null>(null);

  // Derived state
  const isConnected = connectionState === 'connected';
  const isRunning = run?.status === 'pending' || run?.status === 'running';

  // Connect to stream
  const connect = useCallback(() => {
    if (!runId) {
      console.warn('[useRunStream] No runId provided');
      return;
    }

    // Don't reconnect if already connected to same run
    if (clientRef.current && runIdRef.current === runId && isConnected) {
      console.log('[useRunStream] Already connected to run:', runId);
      return;
    }

    // Disconnect existing client
    if (clientRef.current) {
      clientRef.current.close();
      clientRef.current = null;
    }

    runIdRef.current = runId;
    setError(null);

    // Create new stream client
    const manager = getSSEManager();
    const client = manager.createRunStream(
      runId,
      {
        onStatusUpdate: (updatedRun) => {
          setRun(updatedRun);
          onStatusChange?.(updatedRun);
        },
        onEvent: (event) => {
          setEvents((prev) => [...prev, event]);
          onEvent?.(event);
        },
        onComplete: (completedRun) => {
          setRun(completedRun);
          onComplete?.(completedRun);
        },
        onError: (err) => {
          setError(err);
          onError?.(err);
        },
        onClose: () => {
          setConnectionState('closed');
        },
      },
      {
        reconnect: shouldReconnect,
        maxReconnectAttempts,
      }
    );

    if (client) {
      clientRef.current = client;
      
      // Monitor connection state
      const checkState = setInterval(() => {
        if (client) {
          setConnectionState(client.getState());
        }
      }, 500);

      // Cleanup interval on disconnect
      return () => clearInterval(checkState);
    } else {
      setError(new Error('Failed to create stream client (max connections reached)'));
    }
  }, [runId, isConnected, shouldReconnect, maxReconnectAttempts, onStatusChange, onEvent, onComplete, onError]);

  // Disconnect from stream
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.close();
      clientRef.current = null;
      runIdRef.current = null;
    }
    setConnectionState('disconnected');
  }, []);

  // Reconnect to stream
  const reconnectFn = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  // Auto-connect on mount or runId change
  useEffect(() => {
    if (autoConnect && runId) {
      connect();
    }

    // Cleanup on unmount or runId change
    return () => {
      disconnect();
    };
  }, [runId, autoConnect]); // Only depend on runId and autoConnect

  return {
    run,
    events,
    connectionState,
    isConnected,
    isRunning,
    error,
    connect,
    disconnect,
    reconnect: reconnectFn,
  };
}

// ==========================================================================
// ADDITIONAL HOOKS
// ==========================================================================

/**
 * Hook for monitoring multiple runs
 */
export function useMultipleRunStreams(runIds: string[]): Map<string, UseRunStreamReturn> {
  const [streams] = useState(() => new Map<string, UseRunStreamReturn>());

  useEffect(() => {
    // This is a simplified version - in practice, you'd want to manage
    // multiple streams more carefully to avoid React hook rules violations
    console.warn('[useMultipleRunStreams] Not yet implemented');
  }, [runIds]);

  return streams;
}

/**
 * Hook for run status polling (fallback when SSE not available)
 */
export function useRunPolling(
  runId: string | null,
  intervalMs: number = 2000
): { run: Run | null; error: Error | null; refetch: () => void } {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fetchRun = useCallback(async () => {
    if (!runId) return;

    try {
      const response = await fetch(`/api/runs/${runId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch run: ${response.statusText}`);
      }
      const data = await response.json();
      setRun(data);
      setError(null);
    } catch (err: any) {
      setError(err);
    }
  }, [runId]);

  useEffect(() => {
    if (!runId) return;

    // Initial fetch
    fetchRun();

    // Set up polling
    const interval = setInterval(fetchRun, intervalMs);

    // Stop polling when run completes
    if (run && (run.status === 'succeeded' || run.status === 'failed' || run.status === 'timeout')) {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [runId, intervalMs, fetchRun, run]);

  return { run, error, refetch: fetchRun };
}
