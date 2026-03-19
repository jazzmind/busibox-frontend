'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useBusiboxApi, useCrossAppApiPath, useCrossAppBasePath } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';
import { ClassificationSuggestionBadge } from './ClassificationSuggestionBadge';

interface PortalDocumentListProps {
  libraryId?: string;
  onDocumentClick?: (documentId: string) => void;
  prefilledTag?: string;
  onOpenAdvanced?: () => void;
}

interface ClassificationSuggestion {
  libraryId: string;
  libraryName: string;
  matchScore: number;
  matchedKeywords: string[];
  suggestedAction: string;
}

interface DocumentRecord {
  id: string;
  filename?: string | null;
  originalFilename?: string | null;
  extractedTitle?: string | null;
  sizeBytes?: number | null;
  status?: string | null;
  createdAt?: string | null;
  user?: { email?: string };
  metadata?: {
    triggerStatus?: {
      state?: 'pending' | 'running' | 'completed' | 'failed';
    };
    classificationSuggestions?: ClassificationSuggestion[];
  };
}

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

interface SearchChunkResult {
  chunkIndex: number;
  pageNumber: number;
  text: string;
  score: number;
  scores?: SearchScores;
  highlights?: HighlightFragment[];
}

interface GroupedSearchResult {
  fileId: string;
  filename: string;
  topScore: number;
  chunks: SearchChunkResult[];
  expanded: boolean;
  provenance?: ProvenanceData | null;
  provenanceLoading?: boolean;
}

interface ProvenanceNode {
  id: string;
  entity_type: string;
  entity_id: string;
  parent_id: string | null;
  step_type: string;
  input_hash: string;
  output_hash: string;
  chain_hash: string;
  model_version?: string;
  processor_version?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface ProvenanceData {
  file_id: string;
  chain_length: number;
  nodes: ProvenanceNode[];
}

type ViewState = 'documents' | 'search';
type ChatScope = { type: 'all'; fileIds: string[] } | { type: 'single'; fileId: string; filename: string } | null;

function highlightText(text: string, query: string, highlights?: HighlightFragment[]): React.ReactElement {
  if (highlights && highlights.length > 0) {
    const fragment = highlights[0].fragment;
    return <span dangerouslySetInnerHTML={{ __html: fragment }} />;
  }

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

function truncateText(text: string, maxLength: number = 250): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

const STEP_TYPE_LABELS: Record<string, string> = {
  upload: 'Uploaded',
  ocr: 'OCR Processed',
  chunk: 'Chunked',
  embedding: 'Embedded',
  extraction: 'Data Extracted',
  image_extract: 'Images Extracted',
  vlm_describe: 'Vision Described',
  markdown: 'Markdown Generated',
};

const STEP_TYPE_COLORS: Record<string, string> = {
  upload: 'bg-gray-100 text-gray-700',
  ocr: 'bg-blue-100 text-blue-700',
  chunk: 'bg-green-100 text-green-700',
  embedding: 'bg-purple-100 text-purple-700',
  extraction: 'bg-amber-100 text-amber-700',
  image_extract: 'bg-pink-100 text-pink-700',
  vlm_describe: 'bg-indigo-100 text-indigo-700',
  markdown: 'bg-teal-100 text-teal-700',
};

function ProvenanceChain({ provenance }: { provenance: ProvenanceData }) {
  if (!provenance.nodes || provenance.nodes.length === 0) {
    return <div className="text-xs text-gray-400 italic">No provenance data</div>;
  }

  const uniqueSteps = [...new Set(provenance.nodes.map(n => n.step_type))];

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <div className="flex items-center gap-1 mb-1.5">
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span className="text-xs font-medium text-gray-500">Provenance Chain ({provenance.chain_length} steps)</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {uniqueSteps.map((step) => {
          const count = provenance.nodes.filter(n => n.step_type === step).length;
          const colorClass = STEP_TYPE_COLORS[step] || 'bg-gray-100 text-gray-600';
          return (
            <span
              key={step}
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}
              title={`${count} ${step} step${count > 1 ? 's' : ''}`}
            >
              {STEP_TYPE_LABELS[step] || step}
              {count > 1 && <span className="ml-0.5 opacity-70">×{count}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ChatPanel({ scope, onClose, token }: { scope: ChatScope; onClose: () => void; token: string | null }) {
  const [chatToken, setChatToken] = useState<string | null>(token);
  const [loadingToken, setLoadingToken] = useState(!token);
  const resolve = useCrossAppApiPath();

  useEffect(() => {
    if (token) {
      setChatToken(token);
      setLoadingToken(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(resolve('documents', '/api/auth/session'), {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setChatToken(data.token);
        }
      } catch (err) {
        console.error('Failed to get chat token:', err);
      } finally {
        if (!cancelled) setLoadingToken(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, resolve]);

  if (!scope) return null;

  const fileContext = scope.type === 'single'
    ? `You are helping the user understand the document "${scope.filename}". When searching, only search within file_id: ${scope.fileId}. Focus your answers on this document's content.`
    : `You are helping the user analyze ${scope.fileIds.length} documents from their search results. When searching, restrict to these file IDs: ${scope.fileIds.join(', ')}. Focus your answers on content from these documents.`;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] z-50 bg-white shadow-2xl border-l border-gray-200 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="text-sm font-semibold text-gray-900 truncate">
            {scope.type === 'single'
              ? `Chat: ${scope.filename}`
              : `Chat: ${scope.fileIds.length} documents`}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 text-gray-500"
          aria-label="Close chat"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {loadingToken ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Connecting...
          </div>
        ) : chatToken ? (
          <ChatWidget
            token={chatToken}
            context={fileContext}
            fileIds={scope.type === 'single' ? [scope.fileId] : scope.fileIds}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Unable to connect to chat. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}

function ChatWidget({ token, context, fileIds }: { token: string; context: string; fileIds: string[] }) {
  const [SimpleChatInterface, setSimpleChatInterface] = useState<any>(null);

  useEffect(() => {
    import('../chat/SimpleChatInterface').then((mod) => {
      setSimpleChatInterface(() => mod.SimpleChatInterface);
    });
  }, []);

  if (!SimpleChatInterface) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Loading chat...
      </div>
    );
  }

  return (
    <SimpleChatInterface
      token={token}
      enableDocSearch={true}
      placeholder="Ask about these documents..."
      welcomeMessage="I can help you understand the content of your documents. Ask me anything about them."
      useAgenticStreaming={true}
      metadata={{ file_ids: fileIds, system_context: context }}
      className="h-full"
    />
  );
}

export function PortalDocumentList({ libraryId, onDocumentClick, prefilledTag, onOpenAdvanced }: PortalDocumentListProps) {
  const api = useBusiboxApi();
  const resolve = useCrossAppApiPath();
  const documentsBase = useCrossAppBasePath('documents');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'size'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Hybrid search state
  const [viewState, setViewState] = useState<ViewState>('documents');
  const [searchResults, setSearchResults] = useState<GroupedSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [totalChunks, setTotalChunks] = useState(0);

  // Chat state
  const [chatScope, setChatScope] = useState<ChatScope>(null);
  const [chatToken, setChatToken] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const hasActiveWork = documents.some((doc) => {
    const ingestActive = doc.status && !['completed', 'failed'].includes(String(doc.status));
    const triggerState = doc.metadata?.triggerStatus?.state;
    const triggerActive = triggerState === 'pending' || triggerState === 'running';
    return Boolean(ingestActive || triggerActive);
  });

  useEffect(() => {
    setDocuments([]);
    setError(null);
    setLoading(true);
    setViewState('documents');
    setSearchResults([]);
    setSearchInput('');
    setSearchQuery('');
  }, [libraryId]);

  useEffect(() => {
    if (viewState === 'documents') {
      void loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, sortBy, sortOrder, statusFilter, tagFilter, viewState]);

  useEffect(() => {
    if (prefilledTag !== undefined) {
      setTagFilter(prefilledTag);
    }
  }, [prefilledTag]);

  useEffect(() => {
    if (hasActiveWork && libraryId && viewState === 'documents') {
      pollIntervalRef.current = setInterval(() => {
        void loadDocuments(true);
      }, 5000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveWork, libraryId, viewState]);

  async function loadDocuments(silent = false) {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      if (!libraryId) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({ sortBy, sortOrder });
      if (statusFilter) params.append('status', statusFilter);
      if (tagFilter) params.append('tag', tagFilter);

      const response = await fetch(
        resolve('libraries', `/api/libraries/${libraryId}/documents?${params.toString()}`),
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error('Failed to load documents');
      }

      const result = await response.json();
      const docs = result.data?.documents ?? result.documents ?? [];
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      if (!silent) setError(message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const handleSearch = useCallback(async () => {
    const query = searchInput.trim();
    if (!query) {
      setViewState('documents');
      setSearchResults([]);
      return;
    }

    setSearchQuery(query);
    setSearchLoading(true);
    setSearchError(null);
    setViewState('search');

    try {
      const requestBody = {
        query,
        mode: 'hybrid',
        limit: 30,
        rerank: false,
        highlight: {
          enabled: true,
          fragment_size: 200,
          num_fragments: 3,
        },
      };

      const body = JSON.stringify(requestBody);

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
      const rawResults = data.data?.results || data.results || [];

      const grouped = groupResultsByDocument(rawResults);
      setSearchResults(grouped);
      setTotalChunks(rawResults.length);
      setExecutionTime(data.execution_time_ms || data.data?.execution_time_ms);
    } catch (err: any) {
      console.error('Search error:', err);
      setSearchError(err.message || 'Failed to search documents');
    } finally {
      setSearchLoading(false);
    }
  }, [searchInput, api, documentsBase]);

  const groupResultsByDocument = useCallback((rawResults: any[]): GroupedSearchResult[] => {
    const grouped = new Map<string, GroupedSearchResult>();

    for (const result of rawResults) {
      const fileId = result.file_id || result.fileId || '';

      if (!grouped.has(fileId)) {
        grouped.set(fileId, {
          fileId,
          filename: result.filename,
          topScore: result.score,
          chunks: [],
          expanded: false,
          provenance: null,
          provenanceLoading: false,
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

      if (result.score > group.topScore) {
        group.topScore = result.score;
      }
    }

    for (const group of grouped.values()) {
      group.chunks.sort((a, b) => b.score - a.score);
    }

    return Array.from(grouped.values()).sort((a, b) => b.topScore - a.topScore);
  }, []);

  const toggleExpanded = useCallback(async (fileId: string) => {
    setSearchResults(prev => {
      const updated = prev.map(r => {
        if (r.fileId !== fileId) return r;
        const nowExpanded = !r.expanded;
        if (nowExpanded && r.provenance === null && !r.provenanceLoading) {
          loadProvenance(fileId);
          return { ...r, expanded: nowExpanded, provenanceLoading: true };
        }
        return { ...r, expanded: nowExpanded };
      });
      return updated;
    });
  }, []);

  const loadProvenance = useCallback(async (fileId: string) => {
    try {
      const res = await fetch(
        resolve('documents', `/api/documents/${fileId}/provenance`),
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(prev => prev.map(r =>
          r.fileId === fileId ? { ...r, provenance: data, provenanceLoading: false } : r
        ));
      } else {
        setSearchResults(prev => prev.map(r =>
          r.fileId === fileId ? { ...r, provenance: undefined, provenanceLoading: false } : r
        ));
      }
    } catch {
      setSearchResults(prev => prev.map(r =>
        r.fileId === fileId ? { ...r, provenance: undefined, provenanceLoading: false } : r
      ));
    }
  }, [resolve]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
    setViewState('documents');
    setSearchResults([]);
    setSearchError(null);
    setExecutionTime(null);
  }, []);

  const handleChatWithResults = useCallback(() => {
    const fileIds = searchResults.map(r => r.fileId);
    if (fileIds.length > 0) {
      setChatScope({ type: 'all', fileIds });
    }
  }, [searchResults]);

  const handleChatWithDocument = useCallback((fileId: string, filename: string) => {
    setChatScope({ type: 'single', fileId, filename });
  }, []);

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
  };

  if (!libraryId) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Select a library to view documents</div>
      </div>
    );
  }

  if (loading && viewState === 'documents') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading documents...</div>
      </div>
    );
  }

  if (error && viewState === 'documents') {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-500 mb-4">Error: {error}</div>
          <button
            onClick={() => void loadDocuments()}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 flex gap-1">
            <div className="relative flex-1">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                  if (e.key === 'Escape' && viewState === 'search') handleClearSearch();
                }}
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 pr-8 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search document content..."
              />
              {viewState === 'search' && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={searchLoading}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 rounded-md transition-colors disabled:opacity-50"
              title="Search"
            >
              {searchLoading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewState === 'documents' && (
            <>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as ['name' | 'createdAt' | 'size', 'asc' | 'desc'];
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Sort documents"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="size-desc">Largest First</option>
                <option value="size-asc">Smallest First</option>
              </select>

              <button
                onClick={() => setShowFiltersModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 01.8 1.6L14 13.5V19a1 1 0 01-1.447.894l-2-1A1 1 0 0110 18v-4.5L3.2 4.6A1 1 0 013 4z" />
                </svg>
                Filters
              </button>
              {onOpenAdvanced && (
                <button
                  onClick={onOpenAdvanced}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Advanced
                </button>
              )}
              <span className="text-xs text-gray-500 ml-auto">
                {documents.length} {documents.length === 1 ? 'doc' : 'docs'}
              </span>
            </>
          )}

          {viewState === 'search' && (
            <>
              {searchResults.length > 0 && (
                <button
                  onClick={handleChatWithResults}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-300 rounded-md text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Chat with results
                </button>
              )}
              <span className="text-xs text-gray-500 ml-auto">
                {searchResults.length} {searchResults.length === 1 ? 'document' : 'documents'}
                {totalChunks > 0 && ` · ${totalChunks} matching sections`}
                {executionTime !== null && ` · ${executionTime}ms`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Filters Modal */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFiltersModal(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl shadow-xl border-t sm:border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Filters</h3>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-600"
                aria-label="Close filters"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
              >
                <option value="">All Status</option>
                <option value="queued">Queued</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tag</label>
              <input
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm"
                placeholder="Tag..."
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-500">
                {documents.length} {documents.length === 1 ? 'doc' : 'docs'}
              </span>
              <button
                onClick={() => {
                  setStatusFilter('');
                  setTagFilter('');
                  setSortBy('createdAt');
                  setSortOrder('desc');
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {tagFilter && viewState === 'documents' && (
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
            Tag: {tagFilter}
          </span>
          <button
            onClick={() => setTagFilter('')}
            className="text-blue-600 hover:text-blue-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Search Error */}
      {searchError && viewState === 'search' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Search failed</p>
              <p className="text-sm text-red-700">{searchError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search Results View */}
      {viewState === 'search' && !searchLoading && !searchError && (
        <div className="space-y-3">
          {searchResults.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">No results found for &ldquo;{searchQuery}&rdquo;</p>
              <p className="text-xs text-gray-400 mt-1">Try different keywords or check your spelling</p>
            </div>
          ) : (
            searchResults.map((result) => (
              <div
                key={result.fileId}
                className="bg-white shadow rounded-lg overflow-hidden border border-gray-200 hover:border-blue-300 transition-colors"
              >
                {/* Document Header */}
                <div className="flex items-center">
                  <button
                    onClick={() => toggleExpanded(result.fileId)}
                    className="flex-1 p-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm truncate">{result.filename}</h4>
                        <p className="text-xs text-gray-500">
                          {result.chunks.length} matching {result.chunks.length === 1 ? 'section' : 'sections'} · 
                          Score: {result.topScore.toFixed(3)}
                        </p>
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${result.expanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 px-2 bg-gray-50 border-l border-gray-200">
                    <button
                      onClick={() => onDocumentClick?.(result.fileId)}
                      className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600 transition-colors"
                      title="Open document"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleChatWithDocument(result.fileId, result.filename)}
                      className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600 transition-colors"
                      title="Chat with this document"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Top Excerpt (always visible) */}
                <div className="p-3 border-t border-gray-100">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      {result.chunks[0].pageNumber > 0 ? `Page ${result.chunks[0].pageNumber}` : 'Section'} · 
                      Chunk {result.chunks[0].chunkIndex}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {result.chunks[0].score.toFixed(3)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 leading-relaxed">
                    {highlightText(
                      truncateText(result.chunks[0].text, 300),
                      searchQuery,
                      result.chunks[0].highlights
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {result.expanded && (
                  <div className="border-t border-gray-200">
                    {/* Additional Excerpts */}
                    {result.chunks.length > 1 && result.chunks.slice(1).map((chunk, idx) => (
                      <div
                        key={`${result.fileId}-${chunk.chunkIndex}-${idx}`}
                        className="p-3 border-t border-gray-100 bg-gray-50"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs text-gray-500">
                            {chunk.pageNumber > 0 ? `Page ${chunk.pageNumber}` : 'Section'} · 
                            Chunk {chunk.chunkIndex}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {chunk.score.toFixed(3)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 leading-relaxed">
                          {highlightText(
                            truncateText(chunk.text, 300),
                            searchQuery,
                            chunk.highlights
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Provenance Section */}
                    <div className="p-3 border-t border-gray-200 bg-white">
                      {result.provenanceLoading ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Loading provenance...
                        </div>
                      ) : result.provenance ? (
                        <ProvenanceChain provenance={result.provenance} />
                      ) : result.provenance === undefined ? (
                        <div className="text-xs text-gray-400 italic">No provenance data available</div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Search Loading */}
      {viewState === 'search' && searchLoading && (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <svg className="animate-spin h-8 w-8 mx-auto text-blue-500 mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Searching documents...</p>
          <p className="text-xs text-gray-400 mt-1">Using hybrid semantic + keyword search</p>
        </div>
      )}

      {/* Documents List View (normal browsing) */}
      {viewState === 'documents' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {documents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No documents found.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {documents.map((doc) => {
                const triggerState = doc.metadata?.triggerStatus?.state;
                return (
                  <li
                    key={doc.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/doc-id', doc.id);
                      e.dataTransfer.setData('text/plain', doc.id);
                      e.dataTransfer.effectAllowed = 'move';
                      const target = e.currentTarget;
                      target.style.opacity = '0.5';
                      setTimeout(() => {
                        target.style.opacity = '1';
                      }, 0);
                    }}
                    onDragEnd={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    className={`px-6 py-4 hover:bg-gray-50 transition-colors ${onDocumentClick ? 'cursor-pointer' : ''} group`}
                    onClick={() => onDocumentClick?.(doc.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="flex-shrink-0 mr-3 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                        title="Drag to move to another library"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                          <circle cx="5" cy="3" r="1.5" />
                          <circle cx="11" cy="3" r="1.5" />
                          <circle cx="5" cy="8" r="1.5" />
                          <circle cx="11" cy="8" r="1.5" />
                          <circle cx="5" cy="13" r="1.5" />
                          <circle cx="11" cy="13" r="1.5" />
                        </svg>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {doc.extractedTitle || doc.originalFilename || doc.filename || doc.id}
                          </div>
                          {doc.status && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                doc.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : doc.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : doc.status === 'processing'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {String(doc.status)}
                            </span>
                          )}
                          {triggerState === 'pending' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                              Trigger queued
                            </span>
                          )}
                          {triggerState === 'running' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Trigger running
                            </span>
                          )}
                          {triggerState === 'failed' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              Trigger failed
                            </span>
                          )}
                          {doc.metadata?.classificationSuggestions && doc.metadata.classificationSuggestions.length > 0 && (
                            <span onClick={(e) => e.stopPropagation()}>
                              <ClassificationSuggestionBadge
                                suggestions={doc.metadata.classificationSuggestions}
                                documentId={doc.id}
                                onMoved={() => {
                                  setDocuments(prev => prev.filter(d => d.id !== doc.id));
                                }}
                              />
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 flex gap-4">
                          <span>Uploaded {formatDate(doc.createdAt)}</span>
                          {doc.sizeBytes && <span>{formatFileSize(doc.sizeBytes)}</span>}
                          {doc.user?.email && <span>by {doc.user.email}</span>}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Chat Panel */}
      {chatScope && (
        <ChatPanel
          scope={chatScope}
          onClose={() => setChatScope(null)}
          token={chatToken}
        />
      )}
    </div>
  );
}
