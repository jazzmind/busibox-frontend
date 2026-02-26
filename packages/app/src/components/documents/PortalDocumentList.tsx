'use client';

import { useEffect, useRef, useState } from 'react';
import { useCrossAppApiPath } from '../../contexts/ApiContext';
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

export function PortalDocumentList({ libraryId, onDocumentClick, prefilledTag, onOpenAdvanced }: PortalDocumentListProps) {
  const resolve = useCrossAppApiPath();
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
  }, [libraryId]);

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, sortBy, sortOrder, statusFilter, searchQuery, tagFilter]);

  useEffect(() => {
    if (prefilledTag !== undefined) {
      setTagFilter(prefilledTag);
    }
  }, [prefilledTag]);

  useEffect(() => {
    if (hasActiveWork && libraryId) {
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
  }, [hasActiveWork, libraryId]);

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
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 flex gap-1">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearchQuery(searchInput);
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
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

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

      {tagFilter && (
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
    </div>
  );
}
