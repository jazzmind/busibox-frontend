'use client';

/**
 * KnowledgeGraph - Interactive force-directed graph visualization
 * 
 * Renders knowledge graph data from the data-api /data/graph endpoints.
 * Uses react-force-graph-2d for Canvas-based rendering (performant with large graphs).
 * 
 * Features:
 * - Interactive force-directed layout
 * - Node color-coding by entity type
 * - Click to expand neighbors
 * - Search and filter by entity type
 * - Zoom/pan controls
 * - Node detail panel on click
 * - Stats header
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, Filter, ZoomIn, ZoomOut, Maximize2, RotateCcw,
  Loader2, AlertCircle, Network, X, ChevronDown,
} from 'lucide-react';

// Dynamic import to avoid SSR issues (canvas-based)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// =============================================================================
// Types
// =============================================================================

interface GraphNode {
  node_id: string;
  name: string;
  entity_type?: string;
  labels?: string[];
  [key: string]: unknown;
  // Force-graph internal props
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  type: string;
  from: string;
  to: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  total_nodes: number;
  total_edges: number;
  graph_available: boolean;
}

interface GraphStats {
  available: boolean;
  total_nodes: number;
  total_relationships: number;
  labels: Record<string, number>;
  relationship_types: Record<string, number>;
}

interface ForceGraphData {
  nodes: ForceGraphNode[];
  links: ForceGraphLink[];
}

interface ForceGraphNode extends GraphNode {
  id: string;
  val: number;
  color: string;
}

interface ForceGraphLink {
  source: string;
  target: string;
  label: string;
}

// =============================================================================
// Constants
// =============================================================================

const ENTITY_COLORS: Record<string, string> = {
  Person: '#4f46e5',         // indigo
  Organization: '#059669',   // emerald
  Technology: '#d97706',     // amber
  Document: '#2563eb',       // blue
  Location: '#dc2626',       // red
  Event: '#7c3aed',          // violet
  Concept: '#0891b2',        // cyan
  Product: '#ea580c',        // orange
  DataDocument: '#6366f1',   // indigo-lighter
  Project: '#16a34a',        // green
  Task: '#ca8a04',           // yellow
  Keyword: '#0d9488',        // teal
  Entity: '#6b7280',         // gray
  Default: '#9ca3af',        // gray-400
};

function getNodeColor(node: GraphNode): string {
  const entityType = node.entity_type || 
    (node.labels && node.labels.find(l => l !== 'GraphNode' && l !== 'Entity')) || 
    'Default';
  return ENTITY_COLORS[entityType] || ENTITY_COLORS.Default;
}

function getEntityType(node: GraphNode): string {
  return node.entity_type || 
    (node.labels && node.labels.find(l => l !== 'GraphNode' && l !== 'Entity')) || 
    'Unknown';
}

// =============================================================================
// Component
// =============================================================================

interface LibraryOption {
  id: string;
  name: string;
  isPersonal?: boolean;
}

interface KnowledgeGraphProps {
  /** Optional document ID to scope the graph to */
  documentId?: string;
  /** Optional callback when a document node is clicked */
  onDocumentClick?: (documentId: string) => void;
  /** Optional library IDs to filter graph (Document nodes only) */
  libraryIds?: string[];
}

export function KnowledgeGraph({ documentId, onDocumentClick, libraryIds: initialLibraryIds }: KnowledgeGraphProps) {
  // State
  const [graphData, setGraphData] = useState<ForceGraphData>({ nodes: [], links: [] });
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ForceGraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showLibraryMenu, setShowLibraryMenu] = useState(false);
  const [libraries, setLibraries] = useState<LibraryOption[]>([]);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(
    new Set(initialLibraryIds || [])
  );
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  const fetchGraphData = useCallback(async (center?: string) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (center) params.set('center', center);
      if (filterType !== 'all') params.set('label', filterType);
      if (selectedLibraryIds.size > 0) {
        params.set('library_ids', Array.from(selectedLibraryIds).join(','));
      }
      params.set('depth', '2');
      params.set('limit', '200');

      const endpoint = documentId
        ? `/api/graph/document/${encodeURIComponent(documentId)}?${params.toString()}`
        : `/api/graph?${params.toString()}`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch graph data: ${response.status}`);
      }

      const data: GraphData = await response.json();

      if (!data.graph_available) {
        setError('Graph database is not available. Neo4j may not be running or NEO4J_URI is not configured.');
        setGraphData({ nodes: [], links: [] });
        return;
      }

      // Convert to force-graph format
      const nodeMap = new Map<string, ForceGraphNode>();
      for (const node of data.nodes) {
        nodeMap.set(node.node_id, {
          ...node,
          id: node.node_id,
          val: node.entity_type === 'Document' || node.entity_type === 'DataDocument' ? 3 : 1,
          color: getNodeColor(node),
        });
      }

      const links: ForceGraphLink[] = data.edges
        .filter(edge => nodeMap.has(edge.from) && nodeMap.has(edge.to))
        .map(edge => ({
          source: edge.from,
          target: edge.to,
          label: edge.type,
        }));

      setGraphData({
        nodes: Array.from(nodeMap.values()),
        links,
      });
    } catch (err) {
      console.error('[KnowledgeGraph] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, [documentId, filterType, selectedLibraryIds]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/graph/stats');
      if (response.ok) {
        const data: GraphStats = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('[KnowledgeGraph] Stats fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchGraphData();
    fetchStats();
  }, [fetchGraphData, fetchStats]);

  // Fetch libraries for filter
  useEffect(() => {
    async function fetchLibraries() {
      try {
        const response = await fetch('/api/libraries');
        if (!response.ok) return;
        const result = await response.json();
        const libs = result?.data?.libraries || result?.libraries || [];
        setLibraries(libs.map((lib: { id: string; name: string; isPersonal?: boolean }) => ({
          id: lib.id,
          name: lib.name,
          isPersonal: lib.isPersonal,
        })));
      } catch {
        // Silently fail
      }
    }
    fetchLibraries();
  }, []);

  // ==========================================================================
  // Node Expansion
  // ==========================================================================

  const expandNode = useCallback(async (nodeId: string) => {
    if (expandedNodes.has(nodeId)) return;

    try {
      const response = await fetch(`/api/graph/entity/${encodeURIComponent(nodeId)}?depth=1&limit=20`);
      if (!response.ok) return;

      const data = await response.json();
      const neighbors = data.neighbors || [];
      const relationships = data.relationships || [];

      if (neighbors.length === 0) return;

      setGraphData(prev => {
        const existingIds = new Set(prev.nodes.map(n => n.id));
        const newNodes: ForceGraphNode[] = [];

        for (const neighbor of neighbors) {
          if (!existingIds.has(neighbor.node_id)) {
            newNodes.push({
              ...neighbor,
              id: neighbor.node_id,
              val: neighbor.entity_type === 'Document' ? 3 : 1,
              color: getNodeColor(neighbor),
            });
          }
        }

        const newLinks: ForceGraphLink[] = [];
        for (const rel of relationships) {
          const from = rel.from || rel.source;
          const to = rel.to || rel.target;
          if (from && to) {
            newLinks.push({
              source: from,
              target: to,
              label: rel.type || 'RELATED_TO',
            });
          }
        }

        return {
          nodes: [...prev.nodes, ...newNodes],
          links: [...prev.links, ...newLinks],
        };
      });

      setExpandedNodes(prev => new Set([...prev, nodeId]));
    } catch (err) {
      console.error('[KnowledgeGraph] Expand error:', err);
    }
  }, [expandedNodes]);

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  const handleNodeClick = useCallback((node: ForceGraphNode) => {
    setSelectedNode(node);
    expandNode(node.id);
  }, [expandNode]);

  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.5, 300);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.5, 300);
    }
  }, []);

  const handleFitToView = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 40);
    }
  }, []);

  const handleReset = useCallback(() => {
    setExpandedNodes(new Set());
    setSelectedNode(null);
    setSearchQuery('');
    setFilterType('all');
    setSelectedLibraryIds(new Set(initialLibraryIds || []));
    fetchGraphData();
  }, [fetchGraphData, initialLibraryIds]);

  // ==========================================================================
  // Search & Filter
  // ==========================================================================

  const filteredData = useMemo(() => {
    if (!searchQuery) return graphData;

    const query = searchQuery.toLowerCase();
    const matchingNodeIds = new Set(
      graphData.nodes
        .filter(n => (n.name || '').toLowerCase().includes(query))
        .map(n => n.id)
    );

    return {
      nodes: graphData.nodes.filter(n => matchingNodeIds.has(n.id)),
      links: graphData.links.filter(
        l => {
          const sourceId = typeof l.source === 'string' ? l.source : (l.source as unknown as ForceGraphNode)?.id;
          const targetId = typeof l.target === 'string' ? l.target : (l.target as unknown as ForceGraphNode)?.id;
          return matchingNodeIds.has(sourceId) && matchingNodeIds.has(targetId);
        }
      ),
    };
  }, [graphData, searchQuery]);

  const entityTypes = useMemo(() => {
    const types = new Set<string>();
    graphData.nodes.forEach(n => {
      const type = getEntityType(n);
      if (type !== 'Unknown') types.add(type);
    });
    return Array.from(types).sort();
  }, [graphData.nodes]);

  // ==========================================================================
  // Rendering
  // ==========================================================================

  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name || node.id || '';
      const fontSize = Math.max(10 / globalScale, 2);
      const nodeRadius = Math.max(5 * Math.sqrt(node.val || 1), 3);

      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = node.color || '#9ca3af';
      ctx.fill();

      // Highlight if selected
      if (selectedNode && node.id === selectedNode.id) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
        ctx.strokeStyle = node.color || '#9ca3af';
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();
      }

      // Draw label if zoomed in enough
      if (globalScale > 0.7) {
        const maxChars = globalScale > 2 ? 30 : 15;
        const displayLabel = label.length > maxChars ? label.substring(0, maxChars) + '...' : label;

        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Text background
        const textWidth = ctx.measureText(displayLabel).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(
          node.x - textWidth / 2 - 1,
          node.y + nodeRadius + 1,
          textWidth + 2,
          fontSize + 2
        );

        // Text
        ctx.fillStyle = '#374151';
        ctx.fillText(displayLabel, node.x, node.y + nodeRadius + 2);
      }
    },
    [selectedNode]
  );

  // Container dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 800,
          height: Math.max(rect.height, 500),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  if (loading && graphData.nodes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Loader2 className="w-10 h-10 text-blue-500 mx-auto mb-4 animate-spin" />
        <p className="text-gray-600">Loading knowledge graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Graph Unavailable</h3>
        <p className="text-gray-600 max-w-md mx-auto mb-4">{error}</p>
        <button
          onClick={handleReset}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Network className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Graph Data Yet</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          Entities and relationships are extracted during document processing. Ensure entity extraction is enabled in Admin → Ingestion Settings, then reprocess documents using &quot;Re-extract Keywords &amp; Entities&quot; from the document menu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      {stats && stats.available && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Network className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600">Nodes:</span>
              <span className="font-semibold text-gray-900">{stats.total_nodes.toLocaleString()}</span>
            </div>
            <div className="text-gray-300">|</div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-600">Relationships:</span>
              <span className="font-semibold text-gray-900">{stats.total_relationships.toLocaleString()}</span>
            </div>
            <div className="text-gray-300">|</div>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(stats.labels).slice(0, 6).map(([label, count]) => (
                <span
                  key={label}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${ENTITY_COLORS[label] || ENTITY_COLORS.Default}20`,
                    color: ENTITY_COLORS[label] || ENTITY_COLORS.Default,
                  }}
                >
                  {label}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search and Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search entities..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Library Filter */}
          {libraries.length > 0 && !documentId && (
            <div className="relative">
              <button
                onClick={() => setShowLibraryMenu(!showLibraryMenu)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                <Network className="w-4 h-4 mr-1.5" />
                {selectedLibraryIds.size === 0
                  ? 'All Libraries'
                  : `${selectedLibraryIds.size} library${selectedLibraryIds.size === 1 ? '' : 'ies'}`}
                <ChevronDown className="w-3 h-3 ml-1.5" />
              </button>
              {showLibraryMenu && (
                <div className="absolute left-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-10 max-h-64 overflow-y-auto">
                  <div className="p-2 border-b border-gray-200">
                    <span className="text-xs font-medium text-gray-500">Filter by library</span>
                  </div>
                  {libraries.map(lib => (
                    <label
                      key={lib.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLibraryIds.has(lib.id)}
                        onChange={e => {
                          setSelectedLibraryIds(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(lib.id);
                            else next.delete(lib.id);
                            return next;
                          });
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="truncate">{lib.name}</span>
                    </label>
                  ))}
                  <div className="p-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLibraryMenu(false);
                        fetchGraphData();
                      }}
                      className="w-full px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              <Filter className="w-4 h-4 mr-1.5" />
              {filterType === 'all' ? 'All Types' : filterType}
              <ChevronDown className="w-3 h-3 ml-1.5" />
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <button
                  onClick={() => { setFilterType('all'); setShowFilterMenu(false); }}
                  className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${filterType === 'all' ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                >
                  All Types
                </button>
                {entityTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => { setFilterType(type); setShowFilterMenu(false); }}
                    className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${filterType === type ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                      style={{ backgroundColor: ENTITY_COLORS[type] || ENTITY_COLORS.Default }}
                    />
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomIn}
              className="p-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleFitToView}
              className="p-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
              title="Fit to View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Graph + Detail Panel */}
      <div className="flex gap-4">
        {/* Graph Canvas */}
        <div
          ref={containerRef}
          className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
          style={{ minHeight: 500 }}
        >
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredData}
            nodeId="id"
            nodeLabel={(node) => {
              const graphNode = node as ForceGraphNode;
              return `${graphNode.name || graphNode.id} (${getEntityType(graphNode)})`;
            }}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(node, color, ctx) => {
              const graphNode = node as ForceGraphNode;
              const r = Math.max(5 * Math.sqrt(graphNode.val || 1), 3);
              ctx.beginPath();
              ctx.arc(graphNode.x ?? 0, graphNode.y ?? 0, r + 2, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            linkColor={() => '#d1d5db'}
            linkWidth={0.5}
            onNodeClick={(node) => handleNodeClick(node as ForceGraphNode)}
            width={selectedNode ? dimensions.width - 320 : dimensions.width}
            height={dimensions.height}
            cooldownTicks={100}
            onEngineStop={() => {
              if (graphRef.current) {
                graphRef.current.zoomToFit(400, 40);
              }
            }}
            backgroundColor="#f9fafb"
          />
        </div>

        {/* Detail Panel */}
        {selectedNode && (
          <div className="w-80 bg-white rounded-lg shadow-sm border border-gray-200 p-4 max-h-[600px] overflow-y-auto flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Entity Details</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Name */}
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">Name</span>
                <p className="text-sm text-gray-900 font-medium">{selectedNode.name || selectedNode.id}</p>
              </div>

              {/* Type */}
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">Type</span>
                <p className="flex items-center gap-1.5 text-sm">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: selectedNode.color }}
                  />
                  {getEntityType(selectedNode)}
                </p>
              </div>

              {/* Node ID */}
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">ID</span>
                <p className="text-xs text-gray-500 font-mono break-all">{selectedNode.id}</p>
              </div>

              {/* Connections */}
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">Connections</span>
                <div className="mt-1 space-y-1">
                  {graphData.links
                    .filter(l => {
                      const sourceId = typeof l.source === 'string' ? l.source : (l.source as unknown as ForceGraphNode)?.id;
                      const targetId = typeof l.target === 'string' ? l.target : (l.target as unknown as ForceGraphNode)?.id;
                      return sourceId === selectedNode.id || targetId === selectedNode.id;
                    })
                    .slice(0, 15)
                    .map((link, i) => {
                      const sourceId = typeof link.source === 'string' ? link.source : (link.source as unknown as ForceGraphNode)?.id;
                      const targetId = typeof link.target === 'string' ? link.target : (link.target as unknown as ForceGraphNode)?.id;
                      const otherId = sourceId === selectedNode.id ? targetId : sourceId;
                      const otherNode = graphData.nodes.find(n => n.id === otherId);
                      const direction = sourceId === selectedNode.id ? '->' : '<-';
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="text-gray-400">{direction}</span>
                          <span className="text-gray-500">{link.label}</span>
                          <span className="text-gray-400">{direction === '->' ? '->' : '<-'}</span>
                          <button
                            onClick={() => {
                              const node = graphData.nodes.find(n => n.id === otherId) as ForceGraphNode;
                              if (node) handleNodeClick(node);
                            }}
                            className="text-blue-600 hover:underline truncate"
                          >
                            {otherNode?.name || otherId}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Actions */}
              {selectedNode.entity_type === 'Document' && onDocumentClick && (
                <button
                  onClick={() => onDocumentClick(selectedNode.id)}
                  className="w-full mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  View Document
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span className="font-medium text-gray-700">Legend:</span>
          {entityTypes.map(type => (
            <span key={type} className="inline-flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: ENTITY_COLORS[type] || ENTITY_COLORS.Default }}
              />
              {type}
            </span>
          ))}
          <span className="text-gray-400 ml-2">Click nodes to expand | Scroll to zoom | Drag to pan</span>
        </div>
      </div>
    </div>
  );
}
