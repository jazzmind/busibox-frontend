'use client';

/**
 * Basic Document Search Component
 *
 * Simple inline search bar for quick document filtering.
 * Results are grouped by document with expandable excerpts.
 * 
 * For advanced search with mode/reranker options, use DocumentSearchAdvanced.
 */

import { useState, useCallback } from 'react';
import { useBusiboxApi } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';

interface ChunkResult {
  chunkIndex: number;
  pageNumber: number;
  text: string;
  score: number;
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
  metadata?: Record<string, any>;
}

function highlightText(text: string, query: string): React.ReactElement {
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

export interface DocumentSearchProps {
  /** Optional: Pre-filter by library ID */
  libraryId?: string;
  /** Optional: Callback when a document is clicked */
  onDocumentClick?: (fileId: string) => void;
}

export function DocumentSearch({ libraryId, onDocumentClick }: DocumentSearchProps) {
  const api = useBusiboxApi();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GroupedResult[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      });

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

    try {
      const requestBody: Record<string, any> = {
        query: query.trim(),
        mode: 'hybrid',
        limit: 30,
      };

      // Add library filter if provided
      if (libraryId) {
        requestBody.filters = { library_id: libraryId };
      }

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
          nextApiBasePath: api.nextApiBasePath,
          path: '/documents/api/documents/search',
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

      const rawResults = data.data?.results || data.results || [];
      const grouped = groupResultsByDocument(rawResults);
      setResults(grouped);
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

  const handleDocumentClick = (fileId: string) => {
    if (onDocumentClick) {
      onDocumentClick(fileId);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Search Input */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search documents..."
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

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-500 mb-3">
              {results.length} {results.length === 1 ? 'document' : 'documents'} found
            </h3>

            {results.map((result) => (
              <div
                key={result.fileId}
                className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors"
              >
                {/* Document Header */}
                <div className="p-3 bg-gray-50 flex items-center justify-between">
                  <button
                    onClick={() => handleDocumentClick(result.fileId)}
                    className="flex items-center space-x-2 hover:text-blue-600 transition-colors text-left"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium text-gray-900 text-sm">{result.filename}</span>
                  </button>
                  
                  {result.chunks.length > 1 && (
                    <button
                      onClick={() => toggleExpanded(result.fileId)}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                    >
                      <span>{result.chunks.length} matches</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${result.expanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Top Excerpt */}
                <div className="p-3 border-t border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">
                    {result.chunks[0].pageNumber > 0 ? `Page ${result.chunks[0].pageNumber}` : 'Match'}
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed">
                    {highlightText(truncateText(result.chunks[0].text, 250), query)}
                  </div>
                </div>

                {/* Expanded Excerpts */}
                {result.expanded && result.chunks.length > 1 && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {result.chunks.slice(1).map((chunk, idx) => (
                      <div
                        key={`${result.fileId}-${chunk.chunkIndex}-${idx}`}
                        className="p-3 border-t border-gray-100"
                      >
                        <div className="text-xs text-gray-500 mb-1">
                          {chunk.pageNumber > 0 ? `Page ${chunk.pageNumber}` : 'Match'}
                        </div>
                        <div className="text-sm text-gray-700 leading-relaxed">
                          {highlightText(truncateText(chunk.text, 250), query)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!searching && !error && results.length === 0 && query === '' && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">Search your documents</p>
          </div>
        )}
      </div>
    </div>
  );
}
