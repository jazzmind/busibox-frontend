'use client';

import { Check, Database, ExternalLink, Loader2, Pencil, SplitSquareVertical, Wand2 } from 'lucide-react';
import { Button, Modal } from '@jazzmind/busibox-app';

interface ExtractionSchemaDocument {
  id: string;
  name: string;
}

interface ExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  schemas: ExtractionSchemaDocument[];
  schemasLoading: boolean;
  schemasError: string | null;
  selectedSchemaId: string;
  onSelectSchema: (id: string) => void;
  onGenerateSchema: () => void;
  onApplySchema: () => void;
  onSeedDefaults: () => void;
  onViewExtractions: () => void;
  generatingSchema: boolean;
  extracting: boolean;
  isExtractionRunning: boolean;
  extractionStatus?: string;
  extractionError?: string;
  seedingDefaults: boolean;
  schemaJustGenerated: boolean;
  showSplitView: boolean;
  onFetchSchemas: () => void;
}

export function ExtractionModal({
  isOpen,
  onClose,
  schemas,
  schemasLoading,
  schemasError,
  selectedSchemaId,
  onSelectSchema,
  onGenerateSchema,
  onApplySchema,
  onSeedDefaults,
  onViewExtractions,
  generatingSchema,
  extracting,
  isExtractionRunning,
  extractionStatus,
  extractionError,
  seedingDefaults,
  schemaJustGenerated,
  showSplitView,
  onFetchSchemas,
}: ExtractionModalProps) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const isBusy = generatingSchema || extracting || isExtractionRunning;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Extract Structured Data"
      size="lg"
      closeOnOverlayClick={!isBusy}
      closeOnEscape={!isBusy}
      showCloseButton={!isBusy}
    >
      {/* Generating schema — full-panel loading state */}
      {generatingSchema ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Analyzing document&hellip;</p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">AI is reading your document and building a custom extraction schema</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Identifying document type, fields, and structure</span>
              </div>
              <div className="w-full bg-indigo-200/50 dark:bg-indigo-800/50 rounded-full h-1.5">
                <div className="bg-indigo-500 dark:bg-indigo-400 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            This typically takes 30&ndash;90 seconds. The schema will be saved automatically.
          </p>
        </div>

      ) : isExtractionRunning ? (
        /* Extraction in progress — simplified state, no form clutter */
        <div className="space-y-4">
          <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 animate-spin text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Extraction in progress&hellip;</p>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 ml-8">
              Records are being extracted from your document. This may take a few minutes.
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={onViewExtractions}
            >
              <SplitSquareVertical className="w-4 h-4 mr-2" />
              {showSplitView ? 'Hide Extractions' : 'View Extractions'}
            </Button>
          </div>
        </div>

      ) : (
        /* Main form */
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Use an extraction schema to pull structured records from this document.
            Fields can be indexed for keyword search, semantic search, or added to the knowledge graph.
          </p>

          {/* Schema error */}
          {schemasError && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2">
              <p className="text-sm text-red-700 dark:text-red-300">{schemasError}</p>
              <button
                onClick={onFetchSchemas}
                className="text-xs text-red-600 dark:text-red-400 underline mt-1"
              >
                Retry
              </button>
            </div>
          )}

          {/* Schema selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Extraction Schema
            </label>
            {schemasLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading schemas&hellip;
              </div>
            ) : (
              <div className="space-y-3">
                {/* Select row — min-w-0 prevents long names from overflowing */}
                <div className="flex items-center gap-2 min-w-0">
                  <select
                    value={selectedSchemaId}
                    onChange={(e) => onSelectSchema(e.target.value)}
                    className="flex-1 min-w-0 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 truncate focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  >
                    <option value="">
                      {schemas.length === 0 ? 'No schemas available' : 'Select schema...'}
                    </option>
                    {schemas.map((schema) => (
                      <option key={schema.id} value={schema.id}>
                        {schema.name}
                      </option>
                    ))}
                  </select>
                  {selectedSchemaId && (
                    <button
                      onClick={() => window.open(`${basePath}/schemas?selected=${selectedSchemaId}`, '_blank')}
                      className="flex-shrink-0 flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                      title="Edit schema"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Schema just generated success banner */}
                {schemaJustGenerated && selectedSchemaId && (
                  <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">Schema generated successfully</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.open(`${basePath}/schemas?selected=${selectedSchemaId}`, '_blank')}
                        className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200 underline"
                      >
                        <Pencil className="w-3 h-3" />
                        Review &amp; Edit Schema
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <span className="text-xs text-green-600 dark:text-green-400">or extract records below</span>
                    </div>
                  </div>
                )}

                {/* Auto-generate row (hidden after schema just generated) */}
                {!schemaJustGenerated && (
                  <div className="rounded-md bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 px-3 py-2.5 flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      No matching schema? Generate one from this document.
                    </span>
                    <Button variant="secondary" size="sm" onClick={onGenerateSchema} disabled={generatingSchema}>
                      <Wand2 className="w-4 h-4 mr-1.5" />
                      Auto-Generate
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* No schemas CTA */}
          {schemas.length === 0 && !schemasLoading && !schemasError && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-3 py-3">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">No extraction schemas found. You can:</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={onSeedDefaults} disabled={seedingDefaults}>
                  <Database className="w-4 h-4 mr-2" />
                  {seedingDefaults ? 'Loading...' : 'Load Default Schemas'}
                </Button>
                <span className="text-xs text-blue-600 dark:text-blue-400">or use Auto-Generate above</span>
              </div>
            </div>
          )}

          {/* Extraction failed banner */}
          {extractionStatus === 'failed' && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2">
              <span className="text-sm text-red-800 dark:text-red-200">
                Extraction failed{extractionError ? `: ${extractionError}` : ''}. Try again.
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={onApplySchema}
              disabled={extracting || !selectedSchemaId}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {extracting ? 'Starting...' : 'Extract Records'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onViewExtractions}
              disabled={!selectedSchemaId}
            >
              <SplitSquareVertical className="w-4 h-4 mr-2" />
              {showSplitView ? 'Hide Extractions' : 'View Extractions'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
