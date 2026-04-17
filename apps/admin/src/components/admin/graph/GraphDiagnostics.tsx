/**
 * Diagnostics tab. Runs the 7-step reachability check and renders results
 * with contextual fix hints. Designed to pinpoint exactly where the
 * data-api → Neo4j path is broken.
 */

'use client';

import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Lightbulb,
} from 'lucide-react';
import type { ReachabilityResult } from './types';

export interface GraphDiagnosticsHandle {
  run: () => void;
}

export const GraphDiagnostics = forwardRef<GraphDiagnosticsHandle>(
  function GraphDiagnostics(_props, ref) {
    const [result, setResult] = useState<ReachabilityResult | null>(null);
    const [running, setRunning] = useState(false);

    const run = useCallback(async () => {
      setRunning(true);
      setResult(null);
      try {
        const res = await fetch('/api/graph/admin/reachability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          setResult({
            ok: false,
            steps: [{
              step: 'proxy',
              ok: false,
              message: `Proxy returned HTTP ${res.status}`,
              duration_ms: 0,
            }],
          });
          return;
        }
        const data = (await res.json()) as ReachabilityResult;
        setResult(data);
      } catch (e) {
        setResult({
          ok: false,
          steps: [{
            step: 'network',
            ok: false,
            message: e instanceof Error ? e.message : 'Request failed',
            duration_ms: 0,
          }],
        });
      } finally {
        setRunning(false);
      }
    }, []);

    useImperativeHandle(ref, () => ({ run }), [run]);

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Reachability check
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Runs end-to-end from data-api: driver installed → env vars →
                DNS → TCP → verify_connectivity → auth query → APOC.
              </p>
            </div>
            <button
              onClick={run}
              disabled={running}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            >
              {running ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {running ? 'Running...' : 'Run reachability check'}
            </button>
          </div>
        </div>

        {result && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              result.ok
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
            }`}
          >
            {result.ok
              ? `All checks passed. Database has ${result.node_count ?? 0} node(s).`
              : 'One or more checks failed. The first failure below is the root cause.'}
          </div>
        )}

        {result && (
          <ol className="space-y-2">
            {result.steps.map((step, i) => (
              <li
                key={`${step.step}-${i}`}
                className={`rounded-xl border overflow-hidden ${
                  step.ok
                    ? 'border-green-200 dark:border-green-800 bg-white dark:bg-gray-800'
                    : 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                }`}
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {step.ok ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {i + 1}. {step.step}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                        <Clock className="w-3 h-3" />
                        {step.duration_ms.toFixed(1)} ms
                      </span>
                    </div>
                    <p
                      className={`text-sm mt-1 ${
                        step.ok
                          ? 'text-gray-900 dark:text-white'
                          : 'text-red-800 dark:text-red-300 font-medium'
                      }`}
                    >
                      {step.message}
                    </p>
                  </div>
                </div>
                {step.fix_hint && !step.ok && (
                  <div className="px-4 py-2 border-t border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span>{step.fix_hint}</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  },
);
