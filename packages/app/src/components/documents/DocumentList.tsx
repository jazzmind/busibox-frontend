'use client';

import { useEffect, useState, useRef } from 'react';
import type { DocumentWithUser } from '../../types/documents';
import { useBusiboxApi } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';

interface DocumentListProps {
  libraryId?: string; // Optional - if not provided, fetches user's documents
  onDocumentClick?: (documentId: string) => void; // Callback when document is clicked
}

export function DocumentList({ libraryId, onDocumentClick }: DocumentListProps) {
  const api = useBusiboxApi();

  const [documents, setDocuments] = useState<DocumentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and sorting
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'size'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState(''); // Input value (typed but not applied)
  const [searchQuery, setSearchQuery] = useState(''); // Applied search query
  const [tagFilter, setTagFilter] = useState('');

  const getTriggerState = (doc: DocumentWithUser): string | undefined => {
    const metadata = doc.metadata as { triggerStatus?: { state?: string } } | undefined;
    return metadata?.triggerStatus?.state;
  };

  // Keep polling while ingest is active or post-processing trigger is pending/running.
  const hasProcessingDocs = documents.some((doc: DocumentWithUser) => {
    const statusActive = doc.status && !['completed', 'failed'].includes(String(doc.status));
    const triggerState = getTriggerState(doc);
    const triggerActive = triggerState === 'pending' || triggerState === 'running';
    return Boolean(statusActive || triggerActive);
  });
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset when library changes to avoid showing stale docs
  useEffect(() => {
    setDocuments([]);
    setError(null);
    setLoading(true);
  }, [libraryId]);

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, sortBy, sortOrder, statusFilter, searchQuery, tagFilter]);

  // Poll for updates when there are processing documents
  useEffect(() => {
    if (hasProcessingDocs && libraryId) {
      pollIntervalRef.current = setInterval(() => {
        loadDocuments(true); // silent refresh
      }, 5000);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProcessingDocs, libraryId]);

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
      if (searchQuery) params.append('search', searchQuery);
      if (tagFilter) params.append('tag', tagFilter);

      const endpoint = `/api/libraries/${libraryId}/documents?${params.toString()}`;

      const res = await fetchServiceFirstFallbackNext({
        service: {
          baseUrl: api.services?.agentApiUrl,
          path: endpoint,
          init: { method: 'GET' },
        },
        next: {
          nextApiBasePath: api.nextApiBasePath,
          path: endpoint,
          init: { method: 'GET' },
        },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });

      if (!res.ok) throw new Error('Failed to load documents');
      const data = await res.json();
      setDocuments(data.data?.documents || data.documents || []);
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  };

  const formatDate = (date: any) => {
    if (!date) return 'Unknown';
    const d = typeof date === 'string' ? new Date(date) : date instanceof Date ? date : new Date(String(date));
    return d.toLocaleDateString();
  };

  if (!libraryId) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Select a library to view documents</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading documents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-500 mb-4">Error: {error}</div>
          <button
            onClick={() => loadDocuments()}
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
      {/* Compact Filter Bar */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input - takes more space */}
          <div className="flex-1 min-w-[150px] flex gap-1">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearchQuery(searchInput);
                }
              }}
              className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search files..."
            />
            <button
              onClick={() => setSearchQuery(searchInput)}
              className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md text-gray-600 transition-colors"
              title="Search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setSearchQuery('');
                }}
                className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md text-gray-600 transition-colors"
                title="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          {/* Sort By */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-') as ['name' | 'createdAt' | 'size', 'asc' | 'desc'];
              setSortBy(field);
              setSortOrder(order);
            }}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="createdAt-desc">Newest First</option>
            <option value="createdAt-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="size-desc">Largest First</option>
            <option value="size-asc">Smallest First</option>
          </select>

          {/* Tag Filter - optional, show only if tag filtering is used */}
          <input
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-24 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Tag..."
          />

          {/* Document count */}
          <span className="text-xs text-gray-500 ml-auto">
            {documents.length} {documents.length === 1 ? 'doc' : 'docs'}
          </span>
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No documents found.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {documents.map((doc: DocumentWithUser) => {
              const triggerState = getTriggerState(doc);
              const showTriggerPending = triggerState === 'pending';
              const showTriggerRunning = triggerState === 'running';
              const showTriggerFailed = triggerState === 'failed';

              return (
              <li 
                key={doc.id} 
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/doc-id', doc.id);
                  e.dataTransfer.setData('text/plain', doc.id);
                  e.dataTransfer.effectAllowed = 'move';
                  // Add visual feedback
                  const target = e.currentTarget;
                  target.style.opacity = '0.5';
                  setTimeout(() => { target.style.opacity = '1'; }, 0);
                }}
                onDragEnd={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                className={`px-6 py-4 hover:bg-gray-50 transition-colors ${onDocumentClick ? 'cursor-pointer' : ''} group`}
                onClick={() => onDocumentClick?.(doc.id)}
              >
                <div className="flex items-center justify-between">
                  {/* Drag handle */}
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
                        {String(doc.extractedTitle || doc.originalFilename || doc.filename || doc.id)}
                      </div>
                      {doc.status && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          doc.status === 'completed' ? 'bg-green-100 text-green-800' :
                          doc.status === 'failed' ? 'bg-red-100 text-red-800' :
                          doc.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {String(doc.status)}
                        </span>
                      )}
                      {showTriggerPending && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          Trigger queued
                        </span>
                      )}
                      {showTriggerRunning && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Trigger running
                        </span>
                      )}
                      {showTriggerFailed && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Trigger failed
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 flex gap-4">
                      <span>Uploaded {formatDate(doc.createdAt)}</span>
                      {typeof doc.sizeBytes === 'number' && <span>{formatFileSize(doc.sizeBytes)}</span>}
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
    </div>
  );
}










