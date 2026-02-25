'use client';

/**
 * KnowledgeGraph - Interactive force-directed graph visualization
 *
 * Renders knowledge graph data from the data-api /data/graph endpoints.
 * Uses react-force-graph-2d for Canvas-based rendering (performant with large graphs).
 *
 * Features:
 * - Interactive force-directed layout with tuned forces
 * - Node color-coding and sizing by entity type
 * - Click to expand neighbors with camera tracking
 * - Search and filter by entity type / library
 * - Floating zoom/pan controls
 * - Animated detail panel overlay on click
 * - Dark mode support throughout
 * - Subtle dot-grid background with depth
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, Filter, ZoomIn, ZoomOut, Maximize2, RotateCcw,
  Loader2, AlertCircle, Network, X, ChevronDown, ExternalLink,
  Maximize, Minimize,
} from 'lucide-react';
import { useCrossAppApiPath } from '../../contexts/ApiContext';

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
  Person: '#4f46e5',
  Organization: '#059669',
  Technology: '#d97706',
  Document: '#2563eb',
  Location: '#dc2626',
  Event: '#7c3aed',
  Concept: '#0891b2',
  Product: '#ea580c',
  DataDocument: '#6366f1',
  Project: '#16a34a',
  Task: '#ca8a04',
  Keyword: '#0d9488',
  Entity: '#6b7280',
  Default: '#9ca3af',
};

const NODE_SIZES: Record<string, number> = {
  Document: 8,
  DataDocument: 8,
  Person: 5,
  Organization: 5,
  Project: 6,
  Technology: 3,
  Concept: 3,
  Location: 3,
  Event: 3,
  Product: 3,
  Task: 3,
  Keyword: 2,
  Entity: 2,
  Default: 2,
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

function getNodeSize(node: GraphNode): number {
  return NODE_SIZES[getEntityType(node)] || NODE_SIZES.Default;
}

// =============================================================================
// Detail Panel (overlay)
// =============================================================================

interface DetailPanelProps {
  node: ForceGraphNode;
  graphData: ForceGraphData;
  onClose: () => void;
  onNodeNavigate: (node: ForceGraphNode) => void;
  onDocumentClick?: (documentId: string) => void;
}

function DetailPanel({ node, graphData, onClose, onNodeNavigate, onDocumentClick }: DetailPanelProps) {
  const entityType = getEntityType(node);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const connections = useMemo(() => {
    return graphData.links
      .filter(l => {
        const sourceId = typeof l.source === 'string' ? l.source : (l.source as unknown as ForceGraphNode)?.id;
        const targetId = typeof l.target === 'string' ? l.target : (l.target as unknown as ForceGraphNode)?.id;
        return sourceId === node.id || targetId === node.id;
      })
      .slice(0, 20)
      .map((link) => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as unknown as ForceGraphNode)?.id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as unknown as ForceGraphNode)?.id;
        const otherId = sourceId === node.id ? targetId : sourceId;
        const otherNode = graphData.nodes.find(n => n.id === otherId);
        const direction = sourceId === node.id ? 'out' : 'in';
        return { link, otherId, otherNode, direction };
      });
  }, [graphData, node.id]);

  const connectionsByType = useMemo(() => {
    const grouped = new Map<string, typeof connections>();
    for (const conn of connections) {
      const type = conn.link.label;
      if (!grouped.has(type)) grouped.set(type, []);
      grouped.get(type)!.push(conn);
    }
    return grouped;
  }, [connections]);

  return (
    <div
      className="absolute top-4 right-4 z-10 w-96 max-w-[calc(100%-2rem)] overflow-hidden rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
      }}
    >
      {/* Colored header */}
      <div
        className="px-5 py-4 text-white relative overflow-hidden"
        style={{ backgroundColor: node.color || '#6b7280' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-black/10" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full bg-white/30"
                />
                <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                  {entityType}
                </span>
              </div>
              <h3 className="text-lg font-bold leading-tight truncate">
                {node.name || node.id}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors ml-2 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm max-h-[60vh] overflow-y-auto">
        {/* Node ID */}
        <div className="px-5 pt-4 pb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</span>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all mt-0.5">{node.id}</p>
        </div>

        {/* Connection summary */}
        <div className="px-5 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Connections</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">({connections.length})</span>
          </div>
        </div>

        {/* Connections grouped by type */}
        <div className="px-5 pb-4 space-y-3">
          {Array.from(connectionsByType.entries()).map(([type, conns]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {type.replace(/_/g, ' ')}
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{conns.length}</span>
              </div>
              <div className="space-y-0.5">
                {conns.map((conn, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <span className="text-gray-400 dark:text-gray-500 text-xs flex-shrink-0">
                      {conn.direction === 'out' ? '→' : '←'}
                    </span>
                    {conn.otherNode ? (
                      <button
                        onClick={() => onNodeNavigate(conn.otherNode as ForceGraphNode)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate text-left"
                      >
                        {conn.otherNode.name || conn.otherId}
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{conn.otherId}</span>
                    )}
                    {conn.otherNode && (
                      <span
                        className="flex-shrink-0 inline-block w-2 h-2 rounded-full ml-auto"
                        style={{ backgroundColor: (conn.otherNode as ForceGraphNode).color || ENTITY_COLORS.Default }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {(entityType === 'Document' || entityType === 'DataDocument') && onDocumentClick && (
          <div className="px-5 pt-2 pb-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => onDocumentClick(node.id)}
              className="w-full px-3 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors inline-flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Document
            </button>
          </div>
        )}
      </div>
    </div>
  );
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
  documentId?: string;
  onDocumentClick?: (documentId: string) => void;
  libraryIds?: string[];
}

export function KnowledgeGraph({ documentId, onDocumentClick, libraryIds: initialLibraryIds }: KnowledgeGraphProps) {
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAutoFitRef = useRef(false);
  const hasTunedRef = useRef(false);

  const resolve = useCrossAppApiPath();

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

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
        ? resolve('graph', `/api/graph/document/${encodeURIComponent(documentId)}?${params.toString()}`)
        : resolve('graph', `/api/graph?${params.toString()}`);

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

      const nodeMap = new Map<string, ForceGraphNode>();
      for (const node of data.nodes) {
        nodeMap.set(node.node_id, {
          ...node,
          id: node.node_id,
          val: getNodeSize(node),
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

      // Reset tuning/fit refs so they re-apply on new data
      hasTunedRef.current = false;
      hasAutoFitRef.current = false;
    } catch (err) {
      console.error('[KnowledgeGraph] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, [documentId, filterType, selectedLibraryIds, resolve]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(resolve('graph', '/api/graph/stats'));
      if (response.ok) {
        const data: GraphStats = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('[KnowledgeGraph] Stats fetch error:', err);
    }
  }, [resolve]);

  useEffect(() => {
    fetchGraphData();
    fetchStats();
  }, [fetchGraphData, fetchStats]);

  useEffect(() => {
    async function fetchLibraries() {
      try {
        const response = await fetch(resolve('libraries', '/api/libraries'));
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
  }, [resolve]);

  // ==========================================================================
  // Node Expansion
  // ==========================================================================

  const expandNode = useCallback(async (nodeId: string) => {
    if (expandedNodes.has(nodeId)) return;

    try {
      const response = await fetch(resolve('graph', `/api/graph/entity/${encodeURIComponent(nodeId)}?depth=1&limit=20`));
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
              val: getNodeSize(neighbor),
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
  }, [expandedNodes, resolve]);

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  const handleNodeClick = useCallback((node: ForceGraphNode) => {
    setSelectedNode(node);
    expandNode(node.id);

    // Pan camera to center node, offset right for the detail panel overlay
    const graph = graphRef.current;
    if (graph && typeof node.x === 'number' && typeof node.y === 'number') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = graph as any;
      const currentZoom = typeof g.zoom === 'function' ? g.zoom() : 1;
      const canvasW = containerRef.current?.clientWidth || window.innerWidth;
      const panelScreenPx = Math.min(420, canvasW * 0.4);
      const worldOffsetX = (panelScreenPx / 2) / currentZoom;
      g.centerAt?.(node.x + worldOffsetX, node.y, 600);
    }
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
      graphRef.current.zoomToFit(400, 60);
    }
  }, []);

  const handleReset = useCallback(() => {
    setExpandedNodes(new Set());
    setSelectedNode(null);
    setSearchQuery('');
    setFilterType('all');
    setSelectedLibraryIds(new Set(initialLibraryIds || []));
    hasAutoFitRef.current = false;
    hasTunedRef.current = false;
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
  // Canvas Rendering
  // ==========================================================================

  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name || node.id || '';
      const fontSize = Math.max(10 / globalScale, 2);
      const baseRadius = Math.max(5 * Math.sqrt(node.val || 1), 3);
      const nodeColor = node.color || '#9ca3af';
      const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

      // Outer glow for larger nodes
      if (node.val >= 5) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, baseRadius + 4 / globalScale, 0, 2 * Math.PI);
        ctx.fillStyle = `${nodeColor}18`;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseRadius, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.fill();

      // Inner highlight (gives 3D depth)
      ctx.beginPath();
      ctx.arc(
        node.x - baseRadius * 0.2,
        node.y - baseRadius * 0.2,
        baseRadius * 0.5,
        0,
        2 * Math.PI
      );
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();

      // Selection ring
      if (selectedNode && node.id === selectedNode.id) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, baseRadius + 2 / globalScale, 0, 2 * Math.PI);
        ctx.strokeStyle = isDark ? '#e5e7eb' : '#ffffff';
        ctx.lineWidth = 3 / globalScale;
        ctx.stroke();
        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // Label
      if (globalScale > 0.5) {
        const maxChars = globalScale > 2 ? 30 : globalScale > 1 ? 20 : 12;
        const displayLabel = label.length > maxChars ? label.substring(0, maxChars) + '...' : label;
        const isLargeNode = node.val >= 5;

        ctx.font = `${isLargeNode ? 'bold ' : ''}${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const textWidth = ctx.measureText(displayLabel).width;
        const bgPadX = 3;
        const bgPadY = 1.5;
        ctx.fillStyle = isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.92)';
        ctx.fillRect(
          node.x - textWidth / 2 - bgPadX,
          node.y + baseRadius + 2,
          textWidth + bgPadX * 2,
          fontSize + bgPadY * 2
        );

        ctx.fillStyle = isDark ? '#e5e7eb' : '#374151';
        ctx.fillText(displayLabel, node.x, node.y + baseRadius + 2 + bgPadY);
      }
    },
    [selectedNode]
  );

  // ==========================================================================
  // Container Dimensions (ResizeObserver + double-rAF)
  // ==========================================================================

  const [dimensions, setDimensions] = useState(() => {
    if (typeof window !== 'undefined') {
      return {
        width: Math.floor(window.innerWidth * 0.95) || 900,
        height: Math.max(Math.floor(window.innerHeight * 0.7), 600),
      };
    }
    return { width: 900, height: 600 };
  });

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth || 900;
      const h = el.clientHeight || 600;
      setDimensions(prev => {
        if (prev.width === w && prev.height === h) return prev;
        return { width: w, height: h };
      });
    };

    const raf = requestAnimationFrame(() => requestAnimationFrame(measure));
    window.addEventListener('resize', measure);

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(containerRef.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, []);

  // ==========================================================================
  // Force Simulation Tuning (applied once per data load)
  // ==========================================================================

  useEffect(() => {
    if (!graphRef.current || filteredData.nodes.length === 0) return;
    if (hasTunedRef.current) return;
    hasTunedRef.current = true;

    const tuneForces = async () => {
      const graph = graphRef.current;
      if (!graph) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linkForce: any = graph.d3Force('link');
      if (linkForce && typeof linkForce.distance === 'function') {
        linkForce.distance((link: ForceGraphLink) => {
          if (link.label === 'MENTIONED_IN') return 100;
          if (link.label === 'RELATED_TO') return 85;
          if (link.label === 'HAS_KEYWORD') return 60;
          return 80;
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chargeForce: any = graph.d3Force('charge');
      if (chargeForce && typeof chargeForce.strength === 'function') {
        chargeForce.strength(-110);
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d3: any = await (Function('return import("d3-force")')());
        if (d3?.forceCollide) {
          graph.d3Force(
            'collision',
            d3.forceCollide((node: ForceGraphNode) => {
              const size = node.val || 2;
              return Math.max(5 * Math.sqrt(size), 3) + 8;
            })
          );
        }
      } catch {
        // d3-force not available — skip collision force
      }

      graph.d3ReheatSimulation();
    };

    void tuneForces();
  }, [filteredData.nodes.length, filteredData.links.length]);

  // ==========================================================================
  // Render
  // ==========================================================================

  if (loading && graphData.nodes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <Loader2 className="w-10 h-10 text-blue-500 mx-auto mb-4 animate-spin" />
        <p className="text-gray-600 dark:text-gray-300">Loading knowledge graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Graph Unavailable</h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-4">{error}</p>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <Network className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Graph Data Yet</h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Entities and relationships are extracted during document processing. Ensure entity extraction is enabled in Admin → Ingestion Settings, then reprocess documents using &quot;Re-extract Keywords &amp; Entities&quot; from the document menu.
        </p>
      </div>
    );
  }

  return (
    <div className={
      isFullscreen
        ? 'fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-gray-900'
        : 'space-y-3'
    }>
      {/* Stats Bar */}
      {stats && stats.available && (
        <div className={`bg-white dark:bg-gray-800 ${isFullscreen ? 'border-b' : 'rounded-lg shadow-sm border'} border-gray-200 dark:border-gray-700 px-4 py-3`}>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Network className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600 dark:text-gray-400">Nodes:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.total_nodes.toLocaleString()}</span>
            </div>
            <div className="text-gray-300 dark:text-gray-600">|</div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-600 dark:text-gray-400">Relationships:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.total_relationships.toLocaleString()}</span>
            </div>
            {!isFullscreen && (
              <>
                <div className="text-gray-300 dark:text-gray-600">|</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.entries(stats.labels).slice(0, 8).map(([label, count]) => (
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className={`bg-white dark:bg-gray-800 ${isFullscreen ? 'border-b' : 'rounded-lg shadow-sm border'} border-gray-200 dark:border-gray-700 px-4 py-3`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search entities..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Network className="w-4 h-4 mr-1.5" />
                {selectedLibraryIds.size === 0
                  ? 'All Libraries'
                  : `${selectedLibraryIds.size} library${selectedLibraryIds.size === 1 ? '' : 'ies'}`}
                <ChevronDown className="w-3 h-3 ml-1.5" />
              </button>
              {showLibraryMenu && (
                <div className="absolute left-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-20 max-h-64 overflow-y-auto">
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Filter by library</span>
                  </div>
                  {libraries.map(lib => (
                    <label
                      key={lib.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-300"
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
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="truncate">{lib.name}</span>
                    </label>
                  ))}
                  <div className="p-2 border-t border-gray-200 dark:border-gray-700">
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

          {/* Type Filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Filter className="w-4 h-4 mr-1.5" />
              {filterType === 'all' ? 'All Types' : filterType}
              <ChevronDown className="w-3 h-3 ml-1.5" />
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                <button
                  onClick={() => { setFilterType('all'); setShowFilterMenu(false); }}
                  className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${filterType === 'all' ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
                >
                  All Types
                </button>
                {entityTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => { setFilterType(type); setShowFilterMenu(false); }}
                    className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${filterType === type ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}
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
        </div>
      </div>

      {/* Graph Canvas + Detail Panel + Controls */}
      <div className={isFullscreen ? 'flex-1 relative min-h-0' : 'relative'}>
        <div
          ref={containerRef}
          className={`w-full overflow-hidden relative ${
            isFullscreen
              ? 'h-full'
              : 'h-[70vh] min-h-[600px] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700'
          }`}
        >
          {/* Background: light mode — subtle dot grid */}
          <div
            className="absolute inset-0 dark:hidden"
            style={{
              backgroundColor: '#f8fafc',
              backgroundImage: 'radial-gradient(circle, rgba(203,213,225,0.4) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          {/* Background: light mode — depth glow */}
          <div
            className="absolute inset-0 dark:hidden"
            style={{
              background: 'radial-gradient(ellipse at 60% 40%, rgba(59,130,246,0.04) 0%, transparent 60%)',
            }}
          />

          {/* Background: dark mode — dot grid */}
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              backgroundColor: '#0f172a',
              backgroundImage: 'radial-gradient(circle, rgba(51,65,85,0.5) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          {/* Background: dark mode — nebula glows */}
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background: 'radial-gradient(ellipse at 30% 30%, rgba(99,102,241,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(139,92,246,0.05) 0%, transparent 50%)',
            }}
          />

          {/* Force graph */}
          <div className="absolute inset-0 z-[1]">
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
                const r = Math.max(5 * Math.sqrt(graphNode.val || 1), 3) + 2;
                ctx.beginPath();
                ctx.arc(graphNode.x ?? 0, graphNode.y ?? 0, r, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
              }}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              linkColor={() => {
                const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
                return isDark ? '#4b5563' : '#d1d5db';
              }}
              linkWidth={0.8}
              onNodeClick={(node) => handleNodeClick(node as ForceGraphNode)}
              width={dimensions.width}
              height={dimensions.height}
              cooldownTicks={200}
              d3AlphaDecay={0.015}
              d3VelocityDecay={0.3}
              onEngineStop={() => {
                if (graphRef.current && !hasAutoFitRef.current) {
                  graphRef.current.zoomToFit(600, 80);
                  hasAutoFitRef.current = true;
                }
              }}
              backgroundColor="transparent"
            />
          </div>

          {/* Floating zoom controls */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-1">
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />
            <button
              onClick={handleFitToView}
              className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Fit to View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />
            <button
              onClick={() => setIsFullscreen(f => !f)}
              className="p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>

          {/* Node count badge */}
          <div className="absolute top-4 left-4 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-gray-100">{filteredData.nodes.length}</span> nodes · <span className="font-medium text-gray-900 dark:text-gray-100">{filteredData.links.length}</span> edges
          </div>
        </div>

        {/* Detail Panel (overlay) */}
        {selectedNode && (
          <DetailPanel
            key={selectedNode.id}
            node={selectedNode}
            graphData={graphData}
            onClose={() => setSelectedNode(null)}
            onNodeNavigate={handleNodeClick}
            onDocumentClick={onDocumentClick}
          />
        )}
      </div>

      {/* Legend */}
      {!isFullscreen && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-300">Legend:</span>
            {entityTypes.map(type => (
              <span key={type} className="inline-flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: ENTITY_COLORS[type] || ENTITY_COLORS.Default }}
                />
                {type}
              </span>
            ))}
            <span className="ml-auto text-gray-400 dark:text-gray-500">Click nodes to expand · Scroll to zoom · Drag to pan</span>
          </div>
        </div>
      )}
    </div>
  );
}
