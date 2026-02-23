'use client';

import { useState } from 'react';
import {
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Square,
  SquareCheck,
  Tag,
  X,
} from 'lucide-react';

export interface TestSuite {
  id: string;
  name: string;
  project: string;
  service: string;
  type: string;
  framework: 'pytest' | 'vitest';
  makeArgs: string;
  description: string;
  estimatedDuration: number;
  path?: string;
  isSecurity?: boolean;
}

interface TestFile {
  path: string;
  category: string; // 'unit' | 'integration' | ...
  selected: boolean;
}

interface TestSuiteCardProps {
  suite: TestSuite;
  onRun: (suite: TestSuite, overrideMakeArgs?: string) => void;
  isRunning?: boolean;
  lastResult?: {
    success: boolean;
    duration: number;
    timestamp: string;
  };
}

export function TestSuiteCard({ suite, onRun, isRunning, lastResult }: TestSuiteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [files, setFiles] = useState<TestFile[]>([]);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [markers, setMarkers] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  // Marker filter — when set, overrides file selection and runs with -m <marker>
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  // Load all files for this service (no category filter — shows unit + integration + pvt)
  const loadFiles = async () => {
    if (files.length > 0 || filesError || loadingFiles) return;

    setLoadingFiles(true);
    setFilesError(null);
    try {
      const params = new URLSearchParams({ service: suite.service });
      const res = await fetch(`/api/tests/list?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();

      // Annotate each file with its category derived from its path
      const loaded: TestFile[] = (data.files ?? []).map((f: string) => {
        const category = f.startsWith('tests/') ? f.split('/')[1] : 'other';
        return { path: f, category, selected: false };
      });
      setFiles(loaded);
      setCategories(data.categories ?? {});
      setMarkers(
        (data.markers ?? []).map((m: string) =>
          m.replace('@pytest.mark.', ''),
        ),
      );
    } catch (err) {
      setFilesError(String(err));
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleExpand = async () => {
    if (!expanded) {
      setExpanded(true);
      await loadFiles();
    } else {
      setExpanded(false);
    }
  };

  // Click a category badge → select all files in that category, clear marker
  const handleCategoryClick = (cat: string) => {
    setSelectedMarker(null);
    setFiles((prev) =>
      prev.map((f) => ({ ...f, selected: f.category === cat })),
    );
  };

  // Click a marker badge → toggle marker filter, clear file selections
  const handleMarkerClick = (marker: string) => {
    setSelectedMarker((prev) => (prev === marker ? null : marker));
    setFiles((prev) => prev.map((f) => ({ ...f, selected: false })));
  };

  const toggleFile = (idx: number) => {
    setSelectedMarker(null);
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, selected: !f.selected } : f)));
  };

  const selectAll = () => {
    setSelectedMarker(null);
    setFiles((prev) => prev.map((f) => ({ ...f, selected: true })));
  };
  const deselectAll = () => {
    setSelectedMarker(null);
    setFiles((prev) => prev.map((f) => ({ ...f, selected: false })));
  };

  const selectedFiles = files.filter((f) => f.selected);

  // Build the makeArgs for the run button
  const buildMakeArgs = (): string => {
    if (selectedMarker) {
      return `SERVICE=${suite.service} ARGS='-m ${selectedMarker}'`;
    }
    if (selectedFiles.length > 0) {
      const paths = selectedFiles.map((f) => f.path).join(' ');
      return `SERVICE=${suite.service} ARGS='${paths}'`;
    }
    return suite.makeArgs;
  };

  const runLabel = (): string => {
    if (selectedMarker) return `Run @${selectedMarker}`;
    if (selectedFiles.length > 0) return `Run ${selectedFiles.length} file(s)`;
    return 'Run All';
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden hover:border-blue-400 transition">
      {/* Card header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={handleExpand}
      >
        <span className="text-gray-400 mt-0.5 flex-shrink-0">
          {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900">{suite.name}</h3>
            {lastResult && (
              lastResult.success
                ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                : <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-gray-500 mb-2">{suite.description}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 font-medium">
              {suite.framework}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {suite.service}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />~{suite.estimatedDuration}s
            </span>
          </div>
        </div>

        {/* Quick-run (full suite) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRun(suite, suite.makeArgs);
          }}
          disabled={isRunning}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition flex-shrink-0 ${
            isRunning
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title="Run full suite"
        >
          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Run All
        </button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
          {loadingFiles && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading test files…
            </div>
          )}

          {filesError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              Failed to load test files: {filesError}
            </div>
          )}

          {!loadingFiles && !filesError && files.length > 0 && (
            <>
              {/* ── Category badges (click to select) ── */}
              {Object.keys(categories).length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide font-medium">
                    Categories — click to select
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(categories).map(([cat, count]) => {
                      const isActive = selectedMarker === null && files.filter(f => f.category === cat).every(f => f.selected) && selectedFiles.filter(f => f.category === cat).length === count;
                      return (
                        <button
                          key={cat}
                          onClick={() => handleCategoryClick(cat)}
                          className={`text-xs px-3 py-1 rounded-full border font-medium transition ${
                            isActive
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {cat}: {count} files
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Marker badges (click to filter by marker) ── */}
              {markers.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide font-medium">
                    Markers — click to run by marker
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {markers.map((marker) => (
                      <button
                        key={marker}
                        onClick={() => handleMarkerClick(marker)}
                        className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full border font-medium transition ${
                          selectedMarker === marker
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-700'
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        {marker}
                        {selectedMarker === marker && (
                          <X className="w-3 h-3 ml-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                  {selectedMarker && (
                    <p className="text-xs text-emerald-700 mt-1.5">
                      Will run: <code className="bg-emerald-50 px-1 rounded">-m {selectedMarker}</code>
                    </p>
                  )}
                </div>
              )}

              {/* ── File list (only shown when no marker selected) ── */}
              {!selectedMarker && (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">
                      Select all
                    </button>
                    <span className="text-gray-300">|</span>
                    <button onClick={deselectAll} className="text-xs text-gray-500 hover:underline">
                      Deselect all
                    </button>
                    {selectedFiles.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {selectedFiles.length}/{files.length} selected
                      </span>
                    )}
                  </div>

                  <ul className="space-y-0.5 max-h-64 overflow-y-auto mb-4 rounded border border-gray-200 bg-white p-1">
                    {files.map((file, idx) => (
                      <li key={file.path}>
                        <button
                          onClick={() => toggleFile(idx)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 transition text-left"
                        >
                          {file.selected ? (
                            <SquareCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium ${
                            file.category === 'unit'
                              ? 'bg-blue-50 text-blue-600'
                              : file.category === 'integration'
                              ? 'bg-purple-50 text-purple-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {file.category}
                          </span>
                          <FileText className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          <span className="text-xs font-mono text-gray-700 truncate">
                            {file.path.replace(/^tests\/[^/]+\//, '')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* ── Run button ── */}
              <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                <p className="text-xs text-gray-400">
                  {selectedMarker
                    ? `Filter: @pytest.mark.${selectedMarker}`
                    : selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) selected`
                    : 'No selection — runs full suite'}
                </p>
                <button
                  onClick={() => onRun(suite, buildMakeArgs())}
                  disabled={isRunning}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    isRunning
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : selectedMarker
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {runLabel()}
                </button>
              </div>
            </>
          )}

          {!loadingFiles && !filesError && files.length === 0 && (
            <p className="text-sm text-gray-400 italic">No test files found.</p>
          )}
        </div>
      )}
    </div>
  );
}
