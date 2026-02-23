/**
 * ToolPlayground Component
 * 
 * Allows testing tools with sample inputs and viewing results
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Tool, ToolSchema } from '@/lib/types';

interface ToolPlaygroundProps {
  tool: Tool;
  token?: string;
}

interface ToolTestResult {
  success: boolean;
  output: Record<string, any> | null;
  error: string | null;
  execution_time_ms: number;
  tool_name: string;
  input_used: Record<string, any>;
  providers_used?: string[];
}

interface ToolConfig {
  providers?: {
    [key: string]: {
      enabled: boolean;
      api_key?: string;
    };
  };
}

// Sample inputs for common built-in tools
const SAMPLE_INPUTS: Record<string, Record<string, any>> = {
  web_search: { query: 'latest technology news', max_results: 3 },
  document_search: { query: 'project requirements', limit: 5, mode: 'hybrid' },
  get_weather: { location: 'London' },
  data_document: { file_path: '/path/to/document.pdf' },
};

export function ToolPlayground({ tool, token }: ToolPlaygroundProps) {
  const [inputs, setInputs] = useState<Record<string, any>>(() => {
    // Initialize with sample inputs if available, or empty object
    return SAMPLE_INPUTS[tool.name] || {};
  });
  const [result, setResult] = useState<ToolTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolConfig, setToolConfig] = useState<ToolConfig | null>(null);

  // Load tool configuration on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`/api/tools/${tool.id}/config`, { headers });
        if (res.ok) {
          const config = await res.json();
          setToolConfig(config);
        }
      } catch (e) {
        // Config not found is fine, use defaults
        console.log('[ToolPlayground] No config found, using defaults');
      }
    }
    loadConfig();
  }, [tool.id, token]);

  // Extract input properties from schema
  const inputProperties = useMemo(() => {
    if (!tool.schema?.input?.properties) return [];
    return Object.entries(tool.schema.input.properties).map(([name, prop]) => ({
      name,
      type: (prop as any).type || 'string',
      description: (prop as any).description || '',
      required: tool.schema?.input?.required?.includes(name) || false,
      default: (prop as any).default,
    }));
  }, [tool.schema]);

  const handleInputChange = (name: string, value: any) => {
    setInputs((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUseSampleInput = () => {
    const sample = SAMPLE_INPUTS[tool.name];
    if (sample) {
      setInputs(sample);
    }
  };

  const handleExecuteTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Include provider config if available (for web_search and similar tools)
      const requestBody: { input: Record<string, any>; providers?: Record<string, any> } = { 
        input: inputs 
      };
      
      if (toolConfig?.providers) {
        requestBody.providers = toolConfig.providers;
      }

      const response = await fetch(`/api/tools/${tool.id}/test`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Test failed with status ${response.status}`);
      }

      const testResult = await response.json();
      setResult(testResult);
    } catch (e: any) {
      console.error('[ToolPlayground] Test failed:', e);
      setError(e.message || 'Failed to execute tool test');
    } finally {
      setLoading(false);
    }
  };

  const renderInputField = (prop: {
    name: string;
    type: string;
    description: string;
    required: boolean;
    default?: any;
  }) => {
    const value = inputs[prop.name] ?? prop.default ?? '';

    switch (prop.type) {
      case 'number':
      case 'integer':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) =>
              handleInputChange(prop.name, e.target.value ? Number(e.target.value) : '')
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={prop.description || prop.name}
          />
        );
      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleInputChange(prop.name, e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {prop.description || prop.name}
            </span>
          </label>
        );
      case 'array':
      case 'object':
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleInputChange(prop.name, parsed);
              } catch {
                // Keep as string if invalid JSON
                handleInputChange(prop.name, e.target.value);
              }
            }}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder={`JSON ${prop.type}`}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(prop.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={prop.description || prop.name}
          />
        );
    }
  };

  const hasSampleInput = tool.name in SAMPLE_INPUTS;

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
        <svg
          className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Live Execution Mode
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            This will execute the tool with real inputs. For tools like web search, this will make
            actual API calls. Use for testing purposes only.
          </p>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Input</h3>
          {hasSampleInput && (
            <button
              onClick={handleUseSampleInput}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              Use Sample Input
            </button>
          )}
        </div>

        {inputProperties.length > 0 ? (
          <div className="space-y-4">
            {inputProperties.map((prop) => (
              <div key={prop.name}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {prop.name}
                  {prop.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {prop.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{prop.description}</p>
                )}
                {renderInputField(prop)}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              No schema defined. Enter JSON input directly:
            </p>
            <textarea
              value={JSON.stringify(inputs, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setInputs(parsed);
                } catch {
                  // Keep as-is if invalid
                }
              }}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder='{"key": "value"}'
            />
          </div>
        )}

        {/* Execute Button */}
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleExecuteTest}
            disabled={loading}
            className={`px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              loading
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Executing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Execute Test
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Execution Error</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Result</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  result.success
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                }`}
              >
                {result.success ? 'Success' : 'Failed'}
              </span>
              {result.providers_used && result.providers_used.length > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  via {result.providers_used.join(', ')}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {result.execution_time_ms}ms
            </div>
          </div>

          {result.error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{result.error}</p>
            </div>
          )}

          {result.output && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Output</h4>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-900 dark:text-gray-100 max-h-96 overflow-y-auto">
                {JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Input Used
            </h4>
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-600 dark:text-gray-400">
              {JSON.stringify(result.input_used, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
