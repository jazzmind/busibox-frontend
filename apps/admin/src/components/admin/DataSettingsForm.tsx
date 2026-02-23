'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import type { DataSettingsRecord as DataSettings } from '@jazzmind/busibox-app/lib/data/settings';

type DataSection = 'features' | 'strategies' | 'chunking' | 'timeouts';

interface DataSettingsFormProps {
  settings: DataSettings;
  onSuccess?: () => void;
  section?: DataSection;
}

const AUTOSAVE_DELAY = 800;

export function DataSettingsForm({ settings, onSuccess, section }: DataSettingsFormProps) {
  const [formData, setFormData] = useState({
    llmCleanupEnabled: settings.llmCleanupEnabled,
    multiFlowEnabled: settings.multiFlowEnabled,
    maxParallelStrategies: settings.maxParallelStrategies,
    markerEnabled: settings.markerEnabled,
    colpaliEnabled: settings.colpaliEnabled,
    entityExtractionEnabled: settings.entityExtractionEnabled,
    chunkSizeMin: settings.chunkSizeMin,
    chunkSizeMax: settings.chunkSizeMax,
    chunkOverlapPct: settings.chunkOverlapPct,
    timeoutSmall: settings.timeoutSmall,
    timeoutMedium: settings.timeoutMedium,
    timeoutLarge: settings.timeoutLarge,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const save = useCallback(async (data: typeof formData) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch('/api/data-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update settings');
      setSaved(true);
      if (onSuccess) onSuccess();
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [onSuccess]);

  const update = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save(next), AUTOSAVE_DELAY);
      return next;
    });
  };

  const show = (s: DataSection) => !section || section === s;

  return (
    <div className="space-y-8">
      {/* Processing Features */}
      {show('features') && <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Features</h3>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="llmCleanupEnabled"
                type="checkbox"
                checked={formData.llmCleanupEnabled}
                onChange={(e) => update('llmCleanupEnabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="llmCleanupEnabled" className="font-medium text-gray-900">LLM Text Cleanup</label>
              <p className="text-sm text-gray-500 mt-1">
                Use AI to clean and normalize extracted text (removes artifacts, fixes spacing, etc.)
              </p>
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="multiFlowEnabled"
                type="checkbox"
                checked={formData.multiFlowEnabled}
                onChange={(e) => update('multiFlowEnabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="multiFlowEnabled" className="font-medium text-gray-900">Multi-Flow Processing</label>
              <p className="text-sm text-gray-500 mt-1">
                Process documents using multiple strategies in parallel to compare results
              </p>
            </div>
          </div>

          {formData.multiFlowEnabled && (
            <div className="ml-7 pl-4 border-l-2 border-gray-200">
              <label htmlFor="maxParallelStrategies" className="block text-sm font-medium text-gray-700 mb-1">
                Max Parallel Strategies
              </label>
              <input
                id="maxParallelStrategies"
                type="number"
                min="1"
                max="3"
                value={formData.maxParallelStrategies}
                onChange={(e) => update('maxParallelStrategies', parseInt(e.target.value) || 3)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Number of strategies to run concurrently (1-3)</p>
            </div>
          )}
        </div>
      </div>}

      {/* Processing Strategies */}
      {show('strategies') && <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Strategies</h3>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="markerEnabled"
                type="checkbox"
                checked={formData.markerEnabled}
                onChange={(e) => update('markerEnabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="markerEnabled" className="font-medium text-gray-900">Marker PDF Processing</label>
              <p className="text-sm text-gray-500 mt-1">
                Enhanced PDF extraction with better table, formula, and structure handling
              </p>
              <p className="text-xs text-amber-600 mt-1">Warning: Requires additional memory (~2GB per document)</p>
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="colpaliEnabled"
                type="checkbox"
                checked={formData.colpaliEnabled}
                onChange={(e) => update('colpaliEnabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="colpaliEnabled" className="font-medium text-gray-900">ColPali Visual Embeddings</label>
              <p className="text-sm text-gray-500 mt-1">
                Generate visual embeddings for semantic image search (PDFs and images)
              </p>
              <p className="text-xs text-amber-600 mt-1">Warning: Requires GPU and ~4GB VRAM</p>
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="entityExtractionEnabled"
                type="checkbox"
                checked={formData.entityExtractionEnabled}
                onChange={(e) => update('entityExtractionEnabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="entityExtractionEnabled" className="font-medium text-gray-900">Entity & Keyword Extraction</label>
              <p className="text-sm text-gray-500 mt-1">
                Extract entities and keywords for the knowledge graph (requires Neo4j)
              </p>
            </div>
          </div>
        </div>
      </div>}

      {/* Chunking Configuration */}
      {show('chunking') && <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Chunking Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="chunkSizeMin" className="block text-sm font-medium text-gray-700 mb-1">Min Chunk Size</label>
            <input
              id="chunkSizeMin"
              type="number"
              min="100"
              max="1000"
              value={formData.chunkSizeMin}
              onChange={(e) => update('chunkSizeMin', parseInt(e.target.value) || 400)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum characters per chunk (100-1000)</p>
          </div>
          <div>
            <label htmlFor="chunkSizeMax" className="block text-sm font-medium text-gray-700 mb-1">Max Chunk Size</label>
            <input
              id="chunkSizeMax"
              type="number"
              min="200"
              max="2000"
              value={formData.chunkSizeMax}
              onChange={(e) => update('chunkSizeMax', parseInt(e.target.value) || 800)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum characters per chunk (200-2000)</p>
          </div>
          <div>
            <label htmlFor="chunkOverlapPct" className="block text-sm font-medium text-gray-700 mb-1">Overlap Percentage</label>
            <input
              id="chunkOverlapPct"
              type="number"
              min="0"
              max="0.5"
              step="0.01"
              value={formData.chunkOverlapPct}
              onChange={(e) => update('chunkOverlapPct', parseFloat(e.target.value) || 0.12)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Chunk overlap as decimal (0-0.5, e.g., 0.12 = 12%)</p>
          </div>
        </div>
      </div>}

      {/* Timeouts */}
      {show('timeouts') && <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Timeouts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="timeoutSmall" className="block text-sm font-medium text-gray-700 mb-1">Small Files (&lt;1MB)</label>
            <input
              id="timeoutSmall"
              type="number"
              min="60"
              max="600"
              step="30"
              value={formData.timeoutSmall}
              onChange={(e) => update('timeoutSmall', parseInt(e.target.value) || 300)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Seconds (60-600)</p>
          </div>
          <div>
            <label htmlFor="timeoutMedium" className="block text-sm font-medium text-gray-700 mb-1">Medium Files (1-10MB)</label>
            <input
              id="timeoutMedium"
              type="number"
              min="120"
              max="1200"
              step="60"
              value={formData.timeoutMedium}
              onChange={(e) => update('timeoutMedium', parseInt(e.target.value) || 600)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Seconds (120-1200)</p>
          </div>
          <div>
            <label htmlFor="timeoutLarge" className="block text-sm font-medium text-gray-700 mb-1">Large Files (&gt;10MB)</label>
            <input
              id="timeoutLarge"
              type="number"
              min="300"
              max="3600"
              step="60"
              value={formData.timeoutLarge}
              onChange={(e) => update('timeoutLarge', parseInt(e.target.value) || 1200)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Seconds (300-3600)</p>
          </div>
        </div>
      </div>}

      {/* Status */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex justify-end">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {saving && <><RefreshCw className="w-3 h-3 animate-spin" /> Saving...</>}
          {!saving && saved && <><Check className="w-3 h-3 text-green-500" /> Saved</>}
        </div>
      </div>
    </div>
  );
}
