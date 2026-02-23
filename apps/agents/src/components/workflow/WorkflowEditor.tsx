'use client';

/**
 * Visual Workflow Editor
 * 
 * A drag-and-drop node-based workflow editor using ReactFlow.
 * Features:
 * - Drag nodes from palette to canvas
 * - Connect nodes with edges
 * - Configure step details in side panel
 * - Save/load workflow definitions
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

import StepNode, { StepNodeData } from './StepNode';
import StepConfigPanel from './StepConfigPanel';

// Step types available in the palette
const STEP_TYPES = [
  { type: 'agent', icon: '🤖', label: 'Agent', description: 'Run an AI agent' },
  { type: 'tool', icon: '🔧', label: 'Tool', description: 'Execute a tool' },
  { type: 'condition', icon: '🔀', label: 'Condition', description: 'Branch based on logic' },
  { type: 'human', icon: '👤', label: 'Human', description: 'Wait for approval' },
  { type: 'parallel', icon: '⚡', label: 'Parallel', description: 'Run steps in parallel' },
  { type: 'loop', icon: '🔁', label: 'Loop', description: 'Iterate over items' },
];

const nodeTypes: NodeTypes = {
  stepNode: StepNode,
};

interface WorkflowEditorProps {
  workflow?: {
    id?: string;
    name: string;
    description?: string;
    layout?: any;
    steps: any[];
    trigger?: any;
    guardrails?: any;
  };
  onSave?: (workflow: any) => void;
  agents?: { id: string; name: string; display_name?: string }[];
  tools?: { id: string; name: string; description?: string }[];
  readOnly?: boolean;
}

// Layout direction type
type LayoutDirection = 'TB' | 'LR' | 'hybrid';

const NODE_WIDTH = 250;
const NODE_HEIGHT = 100;

// Standard dagre-based auto-layout
function getLayoutedElements(nodes: Node[], edges: Edge[], direction: LayoutDirection = 'TB') {
  // For hybrid mode, use the special hybrid layout function
  if (direction === 'hybrid') {
    return getHybridLayoutedElements(nodes, edges);
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: isHorizontal ? 150 : 100,
    ranksep: isHorizontal ? 200 : 75,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Hybrid layout: Vertical main flow with horizontal condition branches
 * 
 * Strategy:
 * 1. Build a graph to understand the flow
 * 2. Identify condition nodes and their branches
 * 3. Use dagre for the main vertical flow (ignoring condition branches)
 * 4. Position condition branches horizontally (left for "else", right for "then")
 * 5. Handle loops by not offsetting branches that point to earlier nodes
 */
function getHybridLayoutedElements(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  // Build adjacency info
  const nodeMap = new Map<string, Node>();
  const nodeDepth = new Map<string, number>(); // Track vertical depth of each node
  nodes.forEach(n => nodeMap.set(n.id, n));

  // Find condition nodes
  const conditionNodes = nodes.filter(n => n.data?.type === 'condition');
  
  // Identify condition branch edges (then/else) - these go horizontal
  const conditionBranchEdges = new Set<string>();
  const thenTargets = new Map<string, string>(); // conditionId -> then target
  const elseTargets = new Map<string, string>(); // conditionId -> else target
  
  edges.forEach(edge => {
    if (edge.sourceHandle === 'then' || edge.sourceHandle === 'else') {
      conditionBranchEdges.add(edge.id);
      const sourceNode = nodeMap.get(edge.source);
      if (sourceNode?.data?.type === 'condition') {
        if (edge.sourceHandle === 'then') {
          thenTargets.set(edge.source, edge.target);
        } else {
          elseTargets.set(edge.source, edge.target);
        }
      }
    }
  });

  // Create a modified edge list for dagre that excludes horizontal branches
  // but keeps the main flow intact
  const mainFlowEdges = edges.filter(e => !conditionBranchEdges.has(e.id));

  // Use dagre to layout the main vertical flow
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: 'TB',
    nodesep: 150,  // Wider horizontal spacing to leave room for branches
    ranksep: 75,   // Reduced vertical spacing
    marginx: 100,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  mainFlowEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Get base positions from dagre
  const basePositions = new Map<string, { x: number; y: number }>();
  nodes.forEach(node => {
    const pos = dagreGraph.node(node.id);
    if (pos) {
      basePositions.set(node.id, { 
        x: pos.x - NODE_WIDTH / 2, 
        y: pos.y - NODE_HEIGHT / 2 
      });
      nodeDepth.set(node.id, pos.y);
    }
  });

  // Now adjust positions for condition branches
  // For each condition, offset its branch targets horizontally
  const horizontalOffsets = new Map<string, number>();
  const BRANCH_OFFSET = 300; // Horizontal offset for branches

  conditionNodes.forEach(condNode => {
    const condId = condNode.id;
    const condDepth = nodeDepth.get(condId) || 0;
    
    const thenTarget = thenTargets.get(condId);
    const elseTarget = elseTargets.get(condId);

    // Check if targets are "forward" nodes (not loops back to earlier nodes)
    // A node is a forward target if its dagre-assigned depth is >= condition's depth
    
    if (thenTarget && nodeMap.has(thenTarget)) {
      const targetDepth = nodeDepth.get(thenTarget) || 0;
      const isForwardBranch = targetDepth >= condDepth;
      
      if (isForwardBranch) {
        // Offset "then" branch to the right
        const currentOffset = horizontalOffsets.get(thenTarget) || 0;
        horizontalOffsets.set(thenTarget, Math.max(currentOffset, BRANCH_OFFSET));
      }
    }

    if (elseTarget && nodeMap.has(elseTarget)) {
      const targetDepth = nodeDepth.get(elseTarget) || 0;
      const isForwardBranch = targetDepth >= condDepth;
      
      if (isForwardBranch) {
        // Offset "else" branch to the left
        const currentOffset = horizontalOffsets.get(elseTarget) || 0;
        horizontalOffsets.set(elseTarget, Math.min(currentOffset, -BRANCH_OFFSET));
      }
    }
  });

  // Apply positions with offsets
  const layoutedNodes = nodes.map((node) => {
    const basePos = basePositions.get(node.id) || { x: 0, y: 0 };
    const hOffset = horizontalOffsets.get(node.id) || 0;
    
    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: {
        x: basePos.x + hOffset,
        y: basePos.y,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Convert workflow steps to ReactFlow nodes/edges
function workflowToGraph(workflow: any): { nodes: Node[]; edges: Edge[] } {
  if (!workflow?.steps?.length) {
    // Return default start node if no steps
    return {
      nodes: [
        {
          id: 'start',
          type: 'stepNode',
          position: { x: 300, y: 50 },
          data: { id: 'start', type: 'start', name: 'Start' },
        },
      ],
      edges: [],
    };
  }

  const nodes: Node[] = [
    {
      id: 'start',
      type: 'stepNode',
      position: workflow.layout?.start || { x: 300, y: 50 },
      data: { id: 'start', type: 'start', name: 'Start' },
    },
  ];

  const edges: Edge[] = [];

  workflow.steps.forEach((step: any, index: number) => {
    // Use saved position if available, otherwise use default
    const savedPosition = workflow.layout?.[step.id];
    const defaultPosition = { x: 300, y: 150 + (index * 150) };
    
    nodes.push({
      id: step.id,
      type: 'stepNode',
      position: savedPosition || defaultPosition,
      data: {
        ...step,
        type: step.type,
        name: step.name || step.id,
        // Normalize agent field - store as both 'agent' and 'agent_id' for UI consistency
        agent: step.agent || step.agent_id,
        agent_id: step.agent || step.agent_id,
      },
    });
  });

  // Create edges (same as before)
  workflow.steps.forEach((step: any, index: number) => {

    if (index === 0) {
      edges.push({
        id: `start-${step.id}`,
        source: 'start',
        target: step.id,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    }

    if (step.next_step) {
      edges.push({
        id: `${step.id}-${step.next_step}`,
        source: step.id,
        target: step.next_step,
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    } else if (index < workflow.steps.length - 1) {
      // Auto-connect to next step if no explicit next_step
      const nextStep = workflow.steps[index + 1];
      edges.push({
        id: `${step.id}-${nextStep.id}`,
        source: step.id,
        target: nextStep.id,
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    }

    // Handle condition branches
    if (step.type === 'condition' && step.condition) {
      if (step.condition.then_step) {
        edges.push({
          id: `${step.id}-then-${step.condition.then_step}`,
          source: step.id,
          sourceHandle: 'then',
          target: step.condition.then_step,
          label: 'Yes',
          style: { stroke: '#22c55e' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
        });
      }
      if (step.condition.else_step) {
        edges.push({
          id: `${step.id}-else-${step.condition.else_step}`,
          source: step.id,
          sourceHandle: 'else',
          target: step.condition.else_step,
          label: 'No',
          style: { stroke: '#ef4444' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
        });
      }
    }
  });

  // Add end node with saved position
  const endY = workflow.steps.length * 150 + 150;
  nodes.push({
    id: 'end',
    type: 'stepNode',
    position: workflow.layout?.end || { x: 300, y: endY },
    data: { id: 'end', type: 'end', name: 'End' },
  });

  // Connect last step to end if no explicit connection
  const lastStep = workflow.steps[workflow.steps.length - 1];
  if (lastStep && !lastStep.next_step && lastStep.type !== 'condition') {
    edges.push({
      id: `${lastStep.id}-end`,
      source: lastStep.id,
      target: 'end',
      markerEnd: { type: MarkerType.ArrowClosed },
    });
  }

  return { nodes, edges };
}

// Convert ReactFlow nodes/edges back to workflow steps
function graphToWorkflow(nodes: Node[], edges: Edge[]): any[] {
  const steps: any[] = [];
  
  // Get non-start/end nodes
  const stepNodes = nodes.filter(n => n.data.type !== 'start' && n.data.type !== 'end');
  
  stepNodes.forEach(node => {
    const step: any = {
      id: node.data.id,
      type: node.data.type,
      name: node.data.name,
    };

    // Copy type-specific data
    // For agent steps, prefer 'agent' field but also check 'agent_id' for backwards compat
    if (node.data.agent) {
      step.agent = node.data.agent;
    } else if (node.data.agent_id) {
      step.agent = node.data.agent_id;
    }
    
    if (node.data.agent_prompt) step.agent_prompt = node.data.agent_prompt;
    if (node.data.tool) step.tool = node.data.tool;
    if (node.data.tool_args) step.tool_args = node.data.tool_args;
    if (node.data.condition) step.condition = node.data.condition;
    if (node.data.human_config) step.human_config = node.data.human_config;
    if (node.data.loop_config) step.loop_config = node.data.loop_config;
    if (node.data.guardrails) step.guardrails = node.data.guardrails;

    // Find next step from edges
    const outgoingEdge = edges.find(e => e.source === node.id && !e.sourceHandle);
    if (outgoingEdge && outgoingEdge.target !== 'end') {
      step.next_step = outgoingEdge.target;
    }

    steps.push(step);
  });

  return steps;
}

function WorkflowEditorInner({
  workflow,
  onSave,
  agents,
  tools,
  readOnly,
}: WorkflowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();

  // Initialize nodes/edges from workflow
  const initialGraph = useMemo(() => workflowToGraph(workflow), [workflow]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);

  // State
  const [selectedStep, setSelectedStep] = useState<StepNodeData | null>(null);
  const [draggedType, setDraggedType] = useState<string | null>(null);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('hybrid');
  const [hasInitialized, setHasInitialized] = useState(false);
  const { fitView } = useReactFlow();

  // Check if workflow has a saved layout
  const hasSavedLayout = useMemo(() => {
    return workflow?.layout && Object.keys(workflow.layout).length > 0;
  }, [workflow?.layout]);

  // Apply auto-layout on mount if no saved layout exists
  useEffect(() => {
    if (!hasInitialized && nodes.length > 0) {
      setHasInitialized(true);
      
      // If no saved layout, apply auto-layout
      if (!hasSavedLayout) {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, layoutDirection);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      }
      
      // Fit view with more zoom padding after a short delay to allow rendering
      setTimeout(() => {
        fitView({ padding: 0.3, maxZoom: 0.8 });
      }, 50);
    }
  }, [hasInitialized, nodes.length, hasSavedLayout, layoutDirection, nodes, edges, setNodes, setEdges, fitView]);

  // Handle click on pane (background) to deselect
  const onPaneClick = useCallback(() => {
    setSelectedStep(null);
  }, []);

  // Handle node click for editing
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.data.type !== 'start' && node.data.type !== 'end' && !readOnly) {
        setSelectedStep(node.data as StepNodeData);
      }
    },
    [readOnly]
  );

  // Handle edge connections
  const onConnect = useCallback(
    (connection: Connection) => {
      const edge: Edge = {
        ...connection,
        id: `${connection.source}-${connection.target}`,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: true,
      } as Edge;
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  // Handle drag from palette
  const onDragStart = useCallback((event: React.DragEvent, type: string) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedType(type);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDraggedType(null);

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || readOnly) return;

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // Generate unique ID
      const id = `${type}_${Date.now()}`;

      const newNode: Node = {
        id,
        type: 'stepNode',
        position,
        data: {
          id,
          type,
          name: `New ${type}`,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [project, setNodes, readOnly]
  );

  // Handle step update from config panel
  const onStepUpdate = useCallback(
    (updatedStep: StepNodeData) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === updatedStep.id
            ? { ...node, data: updatedStep }
            : node
        )
      );
    },
    [setNodes]
  );

  // Handle step deletion
  const onDeleteStep = useCallback(
    (stepId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== stepId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== stepId && edge.target !== stepId)
      );
      setSelectedStep(null);
    },
    [setNodes, setEdges]
  );

  // Auto-layout nodes
  const handleAutoLayout = useCallback((direction?: LayoutDirection) => {
    const dir = direction || layoutDirection;
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, dir);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    // Fit view after layout with comfortable zoom
    setTimeout(() => {
      fitView({ padding: 0.3, maxZoom: 0.8 });
    }, 50);
  }, [nodes, edges, setNodes, setEdges, layoutDirection, fitView]);

  // Cycle through layout directions: hybrid -> vertical -> horizontal -> hybrid
  const handleCycleLayoutDirection = useCallback(() => {
    const directions: LayoutDirection[] = ['hybrid', 'TB', 'LR'];
    const currentIndex = directions.indexOf(layoutDirection);
    const newDirection = directions[(currentIndex + 1) % directions.length];
    setLayoutDirection(newDirection);
    handleAutoLayout(newDirection);
  }, [layoutDirection, handleAutoLayout]);

  // Save workflow with layout positions
  const handleSave = useCallback(() => {
    const steps = graphToWorkflow(nodes, edges);
    
    // Save node positions in layout object
    const layout: Record<string, { x: number; y: number }> = {};
    nodes.forEach(node => {
      layout[node.id] = node.position;
    });
    
    onSave?.({
      ...workflow,
      steps,
      layout,
    });
  }, [nodes, edges, workflow, onSave]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {workflow?.name || 'New Workflow'}
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {nodes.filter((n) => n.data.type !== 'start' && n.data.type !== 'end').length} steps
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto Layout Button Group */}
          <div className="flex items-center rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
            <button
              onClick={() => handleAutoLayout()}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium transition-colors flex items-center gap-2"
              title="Automatically arrange nodes"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
              </svg>
              Auto Layout
            </button>
            <button
              onClick={handleCycleLayoutDirection}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium transition-colors border-l border-gray-200 dark:border-gray-600 flex items-center gap-1"
              title={`Current: ${layoutDirection === 'hybrid' ? 'Hybrid' : layoutDirection === 'TB' ? 'Vertical' : 'Horizontal'}. Click to cycle.`}
            >
              {layoutDirection === 'hybrid' ? (
                // Hybrid layout icon (branching)
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
              ) : layoutDirection === 'TB' ? (
                // Vertical layout icon (top to bottom)
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              ) : (
                // Horizontal layout icon (left to right)
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
              <span className="text-xs min-w-[14px]">
                {layoutDirection === 'hybrid' ? 'Y' : layoutDirection === 'TB' ? 'V' : 'H'}
              </span>
            </button>
          </div>
          {onSave && !readOnly && (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Save Workflow
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Node Palette */}
        {!readOnly && (
          <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Step Types
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Drag steps onto the canvas
            </p>
            <div className="space-y-2">
              {STEP_TYPES.map((stepType) => (
                <div
                  key={stepType.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, stepType.type)}
                  className={`
                    p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 cursor-grab
                    bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500
                    transition-all hover:shadow-md
                    ${draggedType === stepType.type ? 'opacity-50' : ''}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{stepType.icon}</span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {stepType.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {stepType.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 text-sm">
                Legend
              </h4>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span>Start</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span>End</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Yes/Then branch</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>No/Else branch</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={readOnly ? undefined : onNodesChange}
            onEdgesChange={readOnly ? undefined : onEdgesChange}
            onConnect={readOnly ? undefined : onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 0.8 }}
            deleteKeyCode={readOnly ? null : 'Delete'}
            className="bg-gray-100 dark:bg-gray-950"
          >
            <Background color="#94a3b8" gap={20} />
            <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700" />
            <MiniMap
              className="!bg-white dark:!bg-gray-800"
              nodeColor={(node) => {
                const colors: Record<string, string> = {
                  start: '#10b981',
                  end: '#f43f5e',
                  agent: '#3b82f6',
                  tool: '#f97316',
                  condition: '#a855f7',
                  human: '#22c55e',
                  parallel: '#eab308',
                  loop: '#ec4899',
                };
                return colors[node.data?.type] || '#6b7280';
              }}
            />
            
            {/* Empty state hint */}
            {nodes.length === 1 && (
              <Panel position="top-center" className="mt-20">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center max-w-md">
                  <div className="text-4xl mb-3">🎯</div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Start Building Your Workflow
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Drag step types from the left panel onto the canvas to create your workflow.
                    Connect steps by dragging from one node's handle to another.
                  </p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Config Panel */}
      {selectedStep && (
        <StepConfigPanel
          step={selectedStep}
          onUpdate={onStepUpdate}
          onClose={() => setSelectedStep(null)}
          agents={agents}
          tools={tools}
        />
      )}
    </div>
  );
}

export default function WorkflowEditor(props: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
