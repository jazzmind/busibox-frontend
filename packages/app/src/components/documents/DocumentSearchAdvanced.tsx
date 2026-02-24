'use client';

/**
 * Advanced Document Search Component
 *
 * Full-featured search with:
 * - Search mode selection (keyword, semantic, hybrid)
 * - Reranker model selection
 * - Results grouped by document with expandable excerpts
 * - Highlighting of matched terms
 */

import { useState, useCallback } from 'react';
import { useBusiboxApi, useCrossAppApiPath, useCrossAppBasePath } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';

// Types matching search-api response
interface SearchScores {
  dense?: number;
  sparse?: number;
  rerank?: number;
  final: number;
}

interface HighlightFragment {
  fragment: string;
  score: number;
  start_offset: number;
  end_offset: number;
}

interface ChunkResult {
  chunkIndex: number;
  pageNumber: number;
  text: string;
  score: number;
  scores?: SearchScores;
  highlights?: HighlightFragment[];
}

interface GroupedResult {
  fileId: string;
  filename: string;
  topScore: number;
  chunks: ChunkResult[];
  expanded: boolean;
}

interface SearchResult {
  file_id: string;
  fileId?: string;
  filename: string;
  chunk_index: number;
  chunkIndex?: number;
  page_number: number;
  pageNumber?: number;
  text: string;
  score: number;
  scores?: SearchScores;
  highlights?: HighlightFragment[];
  metadata?: Record<string, any>;
}

type SearchMode = 'keyword' | 'semantic' | 'hybrid';
type RerankerModel = 'none' | 'qwen3-gpu' | 'baai-gpu' | 'baai-cpu';

function highlightText(text: string, query: string, highlights?: HighlightFragment[]): React.ReactElement {
  // If server-side highlights are available, use them
  if (highlights && highlights.length > 0) {
    // Just use the first highlight's fragment which has HTML markup
    const fragment = highlights[0].fragment;
    return <span dangerouslySetInnerHTML={{ __html: fragment }} />;
  }

  // Fallback to client-side highlighting
  if (!query.trim()) return <>{text}</>;

  const terms = query
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter((term) => term.length > 2);

  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase());
        return isMatch ? (
          <mark key={index} className="bg-yellow-200 font-medium px-0.5 rounded">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
}

function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function DocumentSearchAdvanced() {
  const api = useBusiboxApi();
  const resolve = useCrossAppApiPath();
  const documentsBase = useCrossAppBasePath('documents');

  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('hybrid');
  const [rerankerModel, setRerankerModel] = useState<RerankerModel>('none');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GroupedResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [totalChunks, setTotalChunks] = useState(0);

  const groupResultsByDocument = useCallback((rawResults: SearchResult[]): GroupedResult[] => {
    const grouped = new Map<string, GroupedResult>();

    for (const result of rawResults) {
      const fileId = result.file_id || result.fileId || '';
      
      if (!grouped.has(fileId)) {
        grouped.set(fileId, {
          fileId,
          filename: result.filename,
          topScore: result.score,
          chunks: [],
          expanded: false,
        });
      }

      const group = grouped.get(fileId)!;
      group.chunks.push({
        chunkIndex: result.chunk_index ?? result.chunkIndex ?? 0,
        pageNumber: result.page_number ?? result.pageNumber ?? -1,
        text: result.text,
        score: result.score,
        scores: result.scores,
        highlights: result.highlights,
      });

      // Update top score if this chunk has a higher score
      if (result.score > group.topScore) {
        group.topScore = result.score;
      }
    }

    // Sort chunks within each group by score
    for (const group of grouped.values()) {
      group.chunks.sort((a, b) => b.score - a.score);
    }

    // Sort groups by top score
    return Array.from(grouped.values()).sort((a, b) => b.topScore - a.topScore);
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError(null);
    setExecutionTime(null);

    try {
      const requestBody = {
        query: query.trim(),
        mode: searchMode,
        limit: 50, // Get more results to group by document
        rerank: rerankerModel !== 'none',
        reranker_model: rerankerModel !== 'none' ? rerankerModel : undefined,
        rerank_k: 100,
        highlight: {
          enabled: true,
          fragment_size: 200,
          num_fragments: 3,
        },
      };

      const body = JSON.stringify(requestBody);

      // Try search-api first, fall back to Next.js route
      const res = await fetchServiceFirstFallbackNext({
        service: {
          baseUrl: api.services?.searchApiUrl,
          path: '/search',
          init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          },
        },
        next: {
          nextApiBasePath: documentsBase,
          path: '/api/documents/search',
          init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          },
        },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: [
            ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
            400, 401, 403, 422,
          ],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.detail || 'Search failed');
      }

      const data = await res.json();

      // Handle both wrapped and unwrapped response formats
      const rawResults = data.data?.results || data.results || [];
      const grouped = groupResultsByDocument(rawResults);
      
      setResults(grouped);
      setTotalChunks(rawResults.length);
      setExecutionTime(data.execution_time_ms || data.data?.execution_time_ms);
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to search documents');
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const toggleExpanded = (fileId: string) => {
    setResults(prev => prev.map(r => 
      r.fileId === fileId ? { ...r, expanded: !r.expanded } : r
    ));
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Search Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Advanced Document Search</h2>

        {/* Search Input */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search your documents..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            disabled={searching}
          />
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {searching ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Searching...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Search</span>
              </>
            )}
          </button>
        </div>

        {/* Search Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Mode
            </label>
            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value as SearchMode)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              disabled={searching}
            >
              <option value="keyword">Keyword (BM25)</option>
              <option value="semantic">Semantic (Vector)</option>
              <option value="hybrid">Hybrid (Recommended)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Hybrid combines keyword matching with semantic understanding
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reranker
            </label>
            <select
              value={rerankerModel}
              onChange={(e) => setRerankerModel(e.target.value as RerankerModel)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              disabled={searching}
            >
              <option value="none">None (Fastest)</option>
              <option value="qwen3-gpu">Qwen3 GPU (Fast)</option>
              <option value="baai-gpu">BAAI GPU (Accurate)</option>
              <option value="baai-cpu">BAAI CPU (Slow)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Reranking improves relevance but adds latency
            </p>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="p-6">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-800 mb-1">Search Failed</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Summary */}
        {results.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {results.length} {results.length === 1 ? 'Document' : 'Documents'} 
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({totalChunks} matching {totalChunks === 1 ? 'section' : 'sections'})
              </span>
            </h3>
            {executionTime !== null && (
              <span className="text-sm text-gray-500">
                {executionTime}ms
              </span>
            )}
          </div>
        )}

        {/* Results List */}
        {results.length > 0 ? (
          <div className="space-y-4">
            {results.map((result) => (
              <div
                key={result.fileId}
                className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors"
              >
                {/* Document Header */}
                <button
                  onClick={() => toggleExpanded(result.fileId)}
                  className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <h4 className="font-medium text-gray-900">{result.filename}</h4>
                      <p className="text-xs text-gray-500">
                        {result.chunks.length} matching {result.chunks.length === 1 ? 'section' : 'sections'} • 
                        Top score: {result.topScore.toFixed(3)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {result.expanded ? 'Hide' : 'Show'} excerpts
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${result.expanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Top Excerpt (always visible) */}
                <div className="p-4 border-t border-gray-100">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      {result.chunks[0].pageNumber > 0 ? `Page ${result.chunks[0].pageNumber}` : 'Section'} • 
                      Score: {result.chunks[0].score.toFixed(3)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed">
                    {highlightText(
                      truncateText(result.chunks[0].text, 300),
                      query,
                      result.chunks[0].highlights
                    )}
                  </div>
                </div>

                {/* Expanded Excerpts */}
                {result.expanded && result.chunks.length > 1 && (
                  <div className="border-t border-gray-200">
                    {result.chunks.slice(1).map((chunk, idx) => (
                      <div
                        key={`${result.fileId}-${chunk.chunkIndex}-${idx}`}
                        className="p-4 border-t border-gray-100 bg-gray-50"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs text-gray-500">
                            {chunk.pageNumber > 0 ? `Page ${chunk.pageNumber}` : 'Section'} • 
                            Score: {chunk.score.toFixed(3)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 leading-relaxed">
                          {highlightText(
                            truncateText(chunk.text, 300),
                            query,
                            chunk.highlights
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : !searching && !error && (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p>Enter a search query to find documents</p>
          </div>
        )}
      </div>
    </div>
  );
}
