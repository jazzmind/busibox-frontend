'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Download, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import AnsiToHtml from 'ansi-to-html';
import type { TestSuite } from './TestSuiteCard';

interface RunConfig {
  suite: TestSuite;
  makeArgs: string;
}

interface TestRunnerProps {
  runConfig: RunConfig | null;
  onClose: () => void;
}

interface TestOutputEvent {
  type: 'start' | 'stdout' | 'stderr' | 'complete' | 'error';
  data?: string;
  error?: string;
  exitCode?: number;
  success?: boolean;
  done?: boolean;
}

const ansiConverter = new AnsiToHtml({
  fg: '#d1d5db',
  bg: '#111827',
  newline: false,
  escapeXML: true,
  stream: true,
});

export function TestRunner({ runConfig, onClose }: TestRunnerProps) {
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; exitCode: number } | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const renderedHtml = useMemo(
    () => ansiConverter.toHtml(output.join('')),
    [output],
  );

  useEffect(() => {
    if (!runConfig) return;

    setOutput([]);
    setResult(null);
    setIsRunning(false);

    let cancelled = false;

    runTests(runConfig).then(() => {
      if (!cancelled) setIsRunning(false);
    });

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [runConfig?.suite.id, runConfig?.makeArgs]); // re-run when suite or args change

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const runTests = async (config: RunConfig) => {
    setIsRunning(true);
    setOutput([`🚀 Starting: ${config.suite.name}\n`]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/tests/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          suiteId: config.suite.id,
          service: config.suite.service,
          makeArgs: config.makeArgs,
          isSecurity: config.suite.isSecurity ?? false,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const event: TestOutputEvent = JSON.parse(part.slice(6));
            handleEvent(event);
            if (event.done) break;
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setOutput((prev) => [...prev, `\n❌ Error: ${String(err)}\n`]);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleEvent = (event: TestOutputEvent) => {
    switch (event.type) {
      case 'start':
        // already showed start message above
        break;
      case 'stdout':
        if (event.data) setOutput((prev) => [...prev, event.data!]);
        break;
      case 'stderr':
        if (event.data) setOutput((prev) => [...prev, event.data!]);
        break;
      case 'complete':
        setIsRunning(false);
        setResult({ success: event.success ?? false, exitCode: event.exitCode ?? 1 });
        setOutput((prev) => [
          ...prev,
          `\n${event.success ? '✅' : '❌'} Tests ${event.success ? 'passed' : 'failed'} (exit ${event.exitCode ?? 1})\n`,
        ]);
        break;
      case 'error':
        setIsRunning(false);
        setOutput((prev) => [...prev, `\n❌ Error: ${event.error ?? event.data}\n`]);
        break;
    }
  };

  const downloadOutput = () => {
    const blob = new Blob([output.join('')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-results-${runConfig?.suite.id ?? 'unknown'}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!runConfig) return null;

  const { suite, makeArgs } = runConfig;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">{suite.name}</h2>
            {isRunning && <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0" />}
            {result && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="text-sm text-gray-600">
                  {result.success ? 'Passed' : 'Failed'} (exit {result.exitCode})
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={downloadOutput}
              disabled={output.length === 0}
              className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
              title="Download output"
            >
              <Download className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Test info */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
            <span>
              <strong>Project:</strong> {suite.project}
            </span>
            <span>•</span>
            <span>
              <strong>Service:</strong> {suite.service}
            </span>
            <span>•</span>
            <span>
              <strong>Type:</strong> {suite.type}
            </span>
          </div>
          <div className="text-xs text-gray-400 font-mono mt-1 truncate">
            run-local-tests.sh {makeArgs}
          </div>
        </div>

        {/* Output */}
        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto p-4 bg-gray-900 text-gray-100 font-mono text-sm"
        >
          <pre
            className="whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {isRunning ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Running tests…
              </span>
            ) : result ? (
              <span>Test execution complete</span>
            ) : (
              <span>Ready</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
