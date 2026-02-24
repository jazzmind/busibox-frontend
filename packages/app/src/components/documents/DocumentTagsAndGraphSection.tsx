'use client';

/**
 * DocumentTagsAndGraphSection - Tags and graph entities for document detail
 *
 * - Shows all extracted keywords (tags) with edit capability
 * - Fetches and displays graph entities (Keyword, Person, Organization, etc.) grouped by type
 */

import { useState, useEffect, useCallback } from 'react';
import { Tag, Pencil, X, Plus, Loader2, Network, ChevronRight } from 'lucide-react';
import { Button } from '@jazzmind/busibox-app';

interface GraphNode {
  node_id: string;
  name: string;
  entity_type?: string;
  labels?: string[];
}

interface DocumentTagsAndGraphSectionProps {
  fileId: string;
  extractedKeywords: string[];
  onTagsUpdated: (keywords: string[]) => void;
  /** Change this value to trigger a re-fetch of graph entities (e.g., after reprocessing) */
  refreshKey?: number;
  /** Render subset of sections */
  mode?: 'full' | 'tags' | 'graph';
}

function GraphEntityBadges({
  graphLoading,
  graphAvailable,
  graphNodes,
  entityGroups,
  entityTypeOrder,
  expandedTypes,
  onToggleType,
}: {
  graphLoading: boolean;
  graphAvailable: boolean;
  graphNodes: GraphNode[];
  entityGroups: Record<string, string[]>;
  entityTypeOrder: string[];
  expandedTypes: Set<string>;
  onToggleType: (type: string) => void;
}) {
  const allTypes = [
    ...entityTypeOrder.filter((t) => entityGroups[t]?.length),
    ...Object.keys(entityGroups).filter((t) => !entityTypeOrder.includes(t) && entityGroups[t]?.length),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Network className="w-4 h-4 text-gray-400" />
        <span className="text-gray-600 font-medium">Graph entities</span>
      </div>
      {graphLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : !graphAvailable || graphNodes.length === 0 ? (
        <p className="text-sm text-gray-500">
          {!graphAvailable ? 'Graph not available.' : 'No graph entities for this document.'}
          {' '}Use Reprocess → Re-extract Keywords & Entities to populate.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {allTypes.map((type) => {
            const count = entityGroups[type].length;
            const isExpanded = expandedTypes.has(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => onToggleType(type)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                  isExpanded
                    ? 'bg-emerald-200 text-emerald-900 ring-1 ring-emerald-300'
                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                }`}
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                {type}
                <span className="text-emerald-600 font-normal">({count})</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DocumentTagsAndGraphSection({
  fileId,
  extractedKeywords,
  onTagsUpdated,
  refreshKey = 0,
  mode = 'full',
}: DocumentTagsAndGraphSectionProps) {
  const [tags, setTags] = useState<string[]>(extractedKeywords || []);
  const [editing, setEditing] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphAvailable, setGraphAvailable] = useState(true);

  useEffect(() => {
    setTags(extractedKeywords || []);
  }, [extractedKeywords]);

  const saveTags = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/documents/api/documents/${fileId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedKeywords: tags }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save tags');
      }
      onTagsUpdated(tags);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [fileId, tags, onTagsUpdated]);

  const addTag = () => {
    const t = newTag.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setNewTag('');
    }
  };

  const removeTag = (idx: number) => {
    setTags(tags.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    if (mode === 'tags') {
      setGraphNodes([]);
      setGraphLoading(false);
      return;
    }
    let cancelled = false;
    setGraphLoading(true);
    fetch(`/api/graph/document/${fileId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setGraphAvailable(data.graph_available ?? false);
        const nodes = (data.nodes || []) as GraphNode[];
        setGraphNodes(nodes);
      })
      .catch(() => {
        if (!cancelled) setGraphAvailable(false);
      })
      .finally(() => {
        if (!cancelled) setGraphLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, refreshKey, mode]);

  const entityGroups = graphNodes.reduce<Record<string, string[]>>((acc, n) => {
    const type = n.entity_type || (n.labels && n.labels[0]) || 'Other';
    if (!acc[type]) acc[type] = [];
    const name = n.name || n.node_id || '';
    if (name && !acc[type].includes(name)) acc[type].push(name);
    return acc;
  }, {});

  const entityTypeOrder = ['Keyword', 'Person', 'Organization', 'Project', 'Technology', 'Location', 'Other'];

  const showTags = mode !== 'graph';
  const showGraph = mode !== 'tags';

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const allExpandedTypes = [
    ...entityTypeOrder.filter((t) => entityGroups[t]?.length && expandedTypes.has(t)),
    ...Object.keys(entityGroups).filter((t) => !entityTypeOrder.includes(t) && entityGroups[t]?.length && expandedTypes.has(t)),
  ];

  return (
    <div className="space-y-3">
      {/* Two-column row: Graph entity badges (left) + Tags (right) */}
      <div className={mode === 'full' ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : 'space-y-4'}>
        {/* Graph entity badges - first column */}
        {showGraph && (
          <GraphEntityBadges
            graphLoading={graphLoading}
            graphAvailable={graphAvailable}
            graphNodes={graphNodes}
            entityGroups={entityGroups}
            entityTypeOrder={entityTypeOrder}
            expandedTypes={expandedTypes}
            onToggleType={toggleType}
          />
        )}

        {/* Tags section - second column */}
        {showTags && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 font-medium">Tags</span>
            {!editing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setEditing(true)}
              >
                <Pencil className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(idx)}
                      className="hover:bg-blue-200 rounded p-0.5"
                      aria-label={`Remove ${t}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder="Add tag..."
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                />
                <Button variant="ghost" size="sm" onClick={addTag}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={saveTags} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setTags(extractedKeywords || []); setSaveError(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {tags.length === 0 ? (
                <span className="text-sm text-gray-500">No tags</span>
              ) : (
                tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {t}
                  </span>
                ))
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Expanded entity panels - full width, flex packed */}
      {showGraph && allExpandedTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 overflow-hidden">
          {allExpandedTypes.map((type) => (
            <div key={type} className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5 min-w-0 max-w-full">
              <span className="text-xs font-medium text-gray-500 uppercase">{type}</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {entityGroups[type].map((name, i) => (
                  <span
                    key={i}
                    className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
