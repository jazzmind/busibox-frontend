/**
 * React Hook for Task Execution Streaming
 * 
 * Provides real-time updates for task/workflow executions via Server-Sent Events (SSE).
 * Shows step-by-step progress as workflow steps execute.
 * 
 * Features:
 * - Automatic connection management
 * - Step progress tracking (start, complete, failed)
 * - Execution status updates
 * - Auto-disconnect on completion
 * - Cleanup on unmount
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ==========================================================================
// TYPES
// ==========================================================================

export interface ExecutionStep {
  step_id: string;
  step_index: number;
  total_steps: number;
  status: 'pending' | 'running' | 'completed' | 'succeeded' | 'failed' | 'skipped';
  duration_seconds?: number;
  output_data?: Record<string, any>;
  error?: string;
  timestamp?: string;
  usage_requests?: number;
  usage_input_tokens?: number;
  usage_output_tokens?: number;
}

export interface ExecutionStatus {
  status: string;
  task_execution_id?: string;
  task_id?: string;
  execution_id?: string;
  workflow_id?: string;
  current_step_id?: string;
  timestamp?: string;
}

export interface ExecutionOutput {
  output_summary?: string;
  output_data?: Record<string, any>;
  step_outputs?: Record<string, any>;
  duration_seconds?: number;
}

export interface ExecutionComplete {
  status: string;
  task_execution_id?: string;
  execution_id?: string;
  duration_seconds?: number;
  error?: string;
}

export interface UseExecutionStreamOptions {
  /**
   * Called when execution status changes
   */
  onStatusChange?: (status: ExecutionStatus) => void;

  /**
   * Called when a step starts
   */
  onStepStart?: (step: ExecutionStep) => void;

  /**
   * Called when a step completes
   */
  onStepComplete?: (step: ExecutionStep) => void;

  /**
   * Called when execution completes
   */
  onComplete?: (result: ExecutionComplete) => void;

  /**
   * Called on error
   */
  onError?: (error: string) => void;
}

export interface UseExecutionStreamReturn {
  /** Current execution status */
  status: string | null;
  
  /** All steps and their progress */
  steps: ExecutionStep[];
  
  /** Current step being executed */
  currentStep: ExecutionStep | null;
  
  /** Whether connected to stream */
  isConnected: boolean;
  
  /** Whether execution is still running */
  isRunning: boolean;
  
  /** Final output when complete */
  output: ExecutionOutput | null;
  
  /** Completion result */
  result: ExecutionComplete | null;
  
  /** Error if any */
  error: string | null;
  
  /** Manually connect to stream */
  connect: () => void;
  
  /** Manually disconnect from stream */
  disconnect: () => void;
}

// ==========================================================================
// HOOK
// ==========================================================================

/**
 * Hook for streaming task/workflow execution progress.
 * 
 * @example
 * ```tsx
 * function ExecutionMonitor({ executionId }: { executionId: string }) {
 *   const { status, steps, currentStep, isRunning, result } = useExecutionStream(executionId);
 * 
 *   return (
 *     <div>
 *       <div>Status: {status}</div>
 *       <div>Steps: {steps.filter(s => s.status === 'completed').length}/{steps.length}</div>
 *       {currentStep && <div>Running: {currentStep.step_id}</div>}
 *       {result && <div>Completed: {result.status} in {result.duration_seconds}s</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useExecutionStream(
  executionId: string | null | undefined,
  options: UseExecutionStreamOptions = {}
): UseExecutionStreamReturn {
  const {
    onStatusChange,
    onStepStart,
    onStepComplete,
    onComplete,
    onError,
  } = options;

  // State
  const [status, setStatus] = useState<string | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [currentStep, setCurrentStep] = useState<ExecutionStep | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [output, setOutput] = useState<ExecutionOutput | null>(null);
  const [result, setResult] = useState<ExecutionComplete | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const executionIdRef = useRef<string | null>(null);

  // Derived state
  const isRunning = status === 'pending' || status === 'running';

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!executionId) return;

    // Don't reconnect to same execution
    if (eventSourceRef.current && executionIdRef.current === executionId) return;

    // Disconnect existing
    disconnect();
    executionIdRef.current = executionId;
    setError(null);

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const url = `${basePath}/api/streams/task-executions/${executionId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.addEventListener('status', (event) => {
      try {
        const data: ExecutionStatus = JSON.parse(event.data);
        setStatus(data.status);
        onStatusChange?.(data);
      } catch (e) {
        console.error('[useExecutionStream] Failed to parse status event:', e);
      }
    });

    es.addEventListener('step_start', (event) => {
      try {
        const data: ExecutionStep = JSON.parse(event.data);
        const step: ExecutionStep = { ...data, status: 'running' };
        
        setCurrentStep(step);
        setSteps(prev => {
          // Update existing or add new
          const existing = prev.findIndex(s => s.step_id === data.step_id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = step;
            return updated;
          }
          return [...prev, step];
        });
        onStepStart?.(step);
      } catch (e) {
        console.error('[useExecutionStream] Failed to parse step_start event:', e);
      }
    });

    es.addEventListener('step_complete', (event) => {
      try {
        const data = JSON.parse(event.data);
        const step: ExecutionStep = {
          step_id: data.step_id,
          step_index: data.step_index,
          total_steps: data.total_steps,
          status: data.status || 'completed',
          duration_seconds: data.duration_seconds,
          output_data: data.output_data,
          error: data.error,
          timestamp: data.timestamp,
          usage_requests: data.usage_requests,
          usage_input_tokens: data.usage_input_tokens,
          usage_output_tokens: data.usage_output_tokens,
        };
        
        setSteps(prev => {
          const existing = prev.findIndex(s => s.step_id === data.step_id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = step;
            return updated;
          }
          return [...prev, step];
        });
        setCurrentStep(null);
        onStepComplete?.(step);
      } catch (e) {
        console.error('[useExecutionStream] Failed to parse step_complete event:', e);
      }
    });

    es.addEventListener('step_failed', (event) => {
      try {
        const data = JSON.parse(event.data);
        const step: ExecutionStep = {
          step_id: data.step_id,
          step_index: data.step_index,
          total_steps: data.total_steps,
          status: 'failed',
          error: data.error,
          output_data: data.output_data,
          timestamp: data.timestamp,
        };
        
        setSteps(prev => {
          const existing = prev.findIndex(s => s.step_id === data.step_id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = step;
            return updated;
          }
          return [...prev, step];
        });
        setCurrentStep(null);
      } catch (e) {
        console.error('[useExecutionStream] Failed to parse step_failed event:', e);
      }
    });

    es.addEventListener('output', (event) => {
      try {
        const data: ExecutionOutput = JSON.parse(event.data);
        setOutput(data);
      } catch (e) {
        console.error('[useExecutionStream] Failed to parse output event:', e);
      }
    });

    es.addEventListener('complete', (event) => {
      try {
        const data: ExecutionComplete = JSON.parse(event.data);
        setResult(data);
        setStatus(data.status);
        setCurrentStep(null);
        onComplete?.(data);
        // Auto-disconnect on completion
        disconnect();
      } catch (e) {
        console.error('[useExecutionStream] Failed to parse complete event:', e);
      }
    });

    es.addEventListener('error', (event) => {
      // SSE error event sent by the server (event: error\ndata: {...})
      try {
        const msgEvent = event as MessageEvent;
        if (msgEvent.data) {
          const data = JSON.parse(msgEvent.data);
          const errMsg = data.error || 'Unknown stream error';
          setError(errMsg);
          onError?.(errMsg);
        }
      } catch {
        // Couldn't parse - ignore, onerror handler below will handle connection issues
      }
    });

    es.onerror = () => {
      // Browser-level connection error (404, connection refused, etc.)
      if (es.readyState === EventSource.CLOSED) {
        setIsConnected(false);
        if (!error) {
          const errMsg = 'Connection to execution stream lost';
          setError(errMsg);
          onError?.(errMsg);
        }
        // Auto-disconnect on permanent failure
        disconnect();
      }
    };
  }, [executionId, disconnect, onStatusChange, onStepStart, onStepComplete, onComplete, onError]);

  // Auto-connect when executionId changes
  useEffect(() => {
    if (executionId) {
      connect();
    }
    return () => disconnect();
  }, [executionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    steps,
    currentStep,
    isConnected,
    isRunning,
    output,
    result,
    error,
    connect,
    disconnect,
  };
}
