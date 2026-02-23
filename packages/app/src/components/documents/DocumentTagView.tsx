'use client';

import { useEffect, useState } from 'react';
import type { TagGroup, DocumentWithUser } from '../../types/documents';
import { useBusiboxApi } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';

interface DocumentTagViewProps {
  libraryId: string;
  onSelectTag?: (tag: string) => void;
}

export function DocumentTagView({ libraryId, onSelectTag }: DocumentTagViewProps) {
  const api = useBusiboxApi();

  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupDocs, setGroupDocs] = useState<Record<string, DocumentWithUser[]>>({});
  const [groupLoading, setGroupLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadTagGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId]);

  async function loadTagGroups(refresh = false) {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const endpoint = `/api/libraries/${libraryId}/tags`;

      const res = await fetchServiceFirstFallbackNext({
        service: {
          baseUrl: api.services?.agentApiUrl,
          path: endpoint,
          init: { method: refresh ? 'POST' : 'GET' },
        },
        next: {
          nextApiBasePath: api.nextApiBasePath,
          path: endpoint,
          init: { method: refresh ? 'POST' : 'GET' },
        },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });

      if (!res.ok) throw new Error('Failed to load tag groups');

      const data = await res.json();
      const tagGroupsArray = data.data?.tagGroups || data.tagGroups || [];
      setTagGroups(tagGroupsArray);

      const newExpanded = new Set<string>();
      tagGroupsArray.forEach((group: TagGroup) => {
        if (group.documentCount && group.documentCount > 0) newExpanded.add(group.name);
      });
      setExpandedGroups(newExpanded);
    } catch (err: any) {
      console.error('Failed to load tag groups:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function toggleGroup(groupName: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
        if (!groupDocs[groupName]) loadGroupDocs(groupName);
      }
      return next;
    });
  }

  async function loadGroupDocs(groupName: string) {
    const group = tagGroups.find((g) => g.name === groupName);
    if (!group) return;

    setGroupLoading((prev) => ({ ...prev, [groupName]: true }));
    try {
      const tagsParam = encodeURIComponent(group.tags.join(','));
      const endpoint = `/api/libraries/${libraryId}/documents?tags=${tagsParam}&sortBy=createdAt&sortOrder=desc`;

      const res = await fetchServiceFirstFallbackNext({
        service: { baseUrl: api.services?.agentApiUrl, path: endpoint, init: { method: 'GET' } },
        next: { nextApiBasePath: api.nextApiBasePath, path: endpoint, init: { method: 'GET' } },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });

      if (!res.ok) throw new Error('Failed to load documents');
      const data = await res.json();
      const docs: DocumentWithUser[] = data.data?.documents || data.documents || [];
      setGroupDocs((prev) => ({ ...prev, [groupName]: docs }));
    } catch (err) {
      console.error('Failed to load documents for group', groupName, err);
    } finally {
      setGroupLoading((prev) => ({ ...prev, [groupName]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading tag groups...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-500 mb-4">Error: {error}</div>
          <button
            onClick={() => loadTagGroups(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (tagGroups.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-8">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tags found</h3>
          <p className="mt-1 text-sm text-gray-500">Documents in this library don't have any extracted tags yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white shadow rounded-lg p-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tag Groups</h3>
          <p className="text-sm text-gray-600">
            {tagGroups.length} groups • {tagGroups.reduce((sum, g) => sum + (g.documentCount || 0), 0)} documents
          </p>
        </div>
        <button
          onClick={() => loadTagGroups(true)}
          disabled={refreshing}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100"
        >
          <svg
            className={`-ml-1 mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-2">
        {tagGroups.map((group) => (
          <div key={group.name} className="bg-white shadow rounded-lg overflow-hidden">
            <button
              onClick={() => toggleGroup(group.name)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedGroups.has(group.name) ? 'transform rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <div className="text-left">
                  <h4 className="text-sm font-medium text-gray-900">{group.name}</h4>
                  <p className="text-xs text-gray-500">
                    {group.tags.length} tags • {group.documentCount || 0} documents
                    {group.confidence && <span className="ml-2">• {Math.round(group.confidence * 100)}% confidence</span>}
                  </p>
                </div>
              </div>
            </button>

            {expandedGroups.has(group.name) && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-wrap gap-2 mb-3">
                  {group.tags.map((tag, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectTag && onSelectTag(tag)}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {groupLoading[group.name] && <div className="text-sm text-gray-500">Loading documents...</div>}
                  {!groupLoading[group.name] && (groupDocs[group.name]?.length ?? 0) === 0 && (
                    <div className="text-sm text-gray-500">No documents found for this group.</div>
                  )}
                  {(groupDocs[group.name] || []).slice(0, 5).map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded-md px-3 py-2"
                    >
                      <div className="text-sm text-gray-900 truncate">{doc.extractedTitle || doc.originalFilename || doc.filename}</div>
                      <div className="text-xs text-gray-500">{new Date(doc.createdAt as any).toLocaleDateString()}</div>
                    </div>
                  ))}
                  {(groupDocs[group.name]?.length || 0) > 5 && (
                    <div className="text-xs text-gray-500">
                      Showing 5 of {groupDocs[group.name]?.length} documents. Click a tag to view all in list view.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}










