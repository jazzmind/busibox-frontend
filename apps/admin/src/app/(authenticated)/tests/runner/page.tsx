'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { TestSuiteCard, TestSuite } from '@/components/admin/tests/TestSuiteCard';
import { TestRunner } from '@/components/admin/tests/TestRunner';
import { TestFilters, FilterOptions } from '@/components/admin/tests/TestFilters';
import { PlayCircle, Loader2, AlertCircle } from 'lucide-react';

interface RunConfig {
  suite: TestSuite;
  makeArgs: string;
}

export default function TestRunnerPage() {
  const searchParams = useSearchParams();
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [filteredSuites, setFilteredSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);
  const [runConfig, setRunConfig] = useState<RunConfig | null>(null);
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<
    Map<string, { success: boolean; duration: number; timestamp: string }>
  >(new Map());

  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    project: '',
    type: '',
    framework: '',
  });

  useEffect(() => {
    loadTestSuites();
  }, []);

  useEffect(() => {
    const type = searchParams.get('type');
    const project = searchParams.get('project');
    const framework = searchParams.get('framework');
    if (type || project || framework) {
      setFilters((prev) => ({
        ...prev,
        type: type || prev.type,
        project: project || prev.project,
        framework: framework || prev.framework,
      }));
    }
  }, [searchParams]);

  useEffect(() => {
    applyFilters();
  }, [testSuites, filters]);

  const loadTestSuites = async () => {
    try {
      const response = await fetch('/api/tests');
      const data = await response.json();
      if (data.message) {
        setUnavailableMessage(data.message);
      }
      setTestSuites(data.testSuites || []);
    } catch (error) {
      console.error('Failed to load test suites:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...testSuites];

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(
        (suite) =>
          suite.name.toLowerCase().includes(search) ||
          suite.description.toLowerCase().includes(search) ||
          suite.service.toLowerCase().includes(search),
      );
    }
    if (filters.project) filtered = filtered.filter((s) => s.project === filters.project);
    if (filters.type) filtered = filtered.filter((s) => s.type === filters.type);
    if (filters.framework) filtered = filtered.filter((s) => s.framework === filters.framework);

    setFilteredSuites(filtered);
  };

  const handleRunTest = (suite: TestSuite, overrideMakeArgs?: string) => {
    const makeArgs = overrideMakeArgs ?? suite.makeArgs;
    setRunConfig({ suite, makeArgs });
    setRunningTests((prev) => new Set(prev).add(suite.id));
  };

  const handleCloseRunner = () => {
    if (runConfig) {
      setRunningTests((prev) => {
        const next = new Set(prev);
        next.delete(runConfig.suite.id);
        return next;
      });
    }
    setRunConfig(null);
  };

  const projects = Array.from(new Set(testSuites.map((s) => s.project)));
  const types = Array.from(new Set(testSuites.map((s) => s.type)));
  const frameworks = Array.from(new Set(testSuites.map((s) => s.framework)));

  const groupedSuites = filteredSuites.reduce(
    (acc, suite) => {
      if (!acc[suite.project]) acc[suite.project] = [];
      acc[suite.project].push(suite);
      return acc;
    },
    {} as Record<string, TestSuite[]>,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Test Runner</h1>
            <p className="text-gray-600 mt-2">
              Run and monitor tests across all projects and services
            </p>
          </div>
          {filteredSuites.length > 0 && (
            <button
              onClick={() => {
                if (filteredSuites.length > 0) handleRunTest(filteredSuites[0]);
              }}
              disabled={filteredSuites.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlayCircle className="w-5 h-5" />
              Run First Suite
            </button>
          )}
        </div>

        {unavailableMessage && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">{unavailableMessage}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{testSuites.length}</div>
            <div className="text-sm text-gray-600">Total Suites</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{filteredSuites.length}</div>
            <div className="text-sm text-gray-600">Filtered</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{runningTests.size}</div>
            <div className="text-sm text-gray-600">Running</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{testResults.size}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <TestFilters
        filters={filters}
        onFilterChange={setFilters}
        projects={projects}
        types={types}
        frameworks={frameworks}
      />

      {/* Suites */}
      {filteredSuites.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-600">No test suites found matching your filters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedSuites).map(([project, suites]) => (
            <div key={project}>
              <h2 className="text-xl font-bold text-gray-900 mb-3 capitalize">{project}</h2>
              <div className="grid grid-cols-1 gap-3">
                {suites.map((suite) => (
                  <TestSuiteCard
                    key={suite.id}
                    suite={suite}
                    onRun={handleRunTest}
                    isRunning={runningTests.has(suite.id)}
                    lastResult={testResults.get(suite.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test Runner Modal */}
      {runConfig && <TestRunner runConfig={runConfig} onClose={handleCloseRunner} />}
    </div>
  );
}
